"""
Rate Limiting Middleware
In-memory token bucket rate limiter.
For production, replace with Redis-backed slowapi or fastapi-limiter.

Limits:
- /api/chat/* : 20 requests/minute per IP
- /api/documents/upload : 10 uploads/minute per IP
- All other routes: 100 requests/minute per IP
"""

import time
import logging
from collections import defaultdict, deque
from threading import Lock
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Sliding window rate limiter.
    Tracks request timestamps per (IP, route_category) bucket.
    """

    def __init__(self):
        self._windows: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    # Route-specific limits: (max_requests, window_seconds)
    LIMITS = {
        "chat":   (20,  60),   # 20 req/min
        "upload": (10,  60),   # 10 req/min
        "default":(100, 60),   # 100 req/min
    }

    def _get_category(self, path: str) -> str:
        if "/chat/" in path:
            return "chat"
        if "/upload" in path:
            return "upload"
        return "default"

    def is_allowed(self, ip: str, path: str) -> tuple[bool, int]:
        """
        Returns (allowed, retry_after_seconds).
        retry_after is only meaningful when allowed=False.
        """
        category = self._get_category(path)
        max_req, window = self.LIMITS[category]
        key = f"{ip}:{category}"
        now = time.monotonic()

        with self._lock:
            window_q = self._windows[key]

            # Remove timestamps outside the window
            cutoff = now - window
            while window_q and window_q[0] < cutoff:
                window_q.popleft()

            if len(window_q) >= max_req:
                # Oldest request in window + window duration = when limit resets
                retry_after = int(window - (now - window_q[0])) + 1
                return False, retry_after

            window_q.append(now)
            return True, 0


_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Attach to FastAPI app to apply rate limiting globally"""

    EXEMPT_PATHS = {"/api/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip rate limiting for health checks and docs
        if path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Get client IP (handles reverse proxy)
        ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or request.headers.get("X-Real-IP", "")
            or (request.client.host if request.client else "unknown")
        )

        allowed, retry_after = _limiter.is_allowed(ip, path)

        if not allowed:
            logger.warning(f"Rate limit exceeded: {ip} → {path}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please slow down.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        return response
