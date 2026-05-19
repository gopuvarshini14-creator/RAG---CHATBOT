"""
Request Logging Middleware
Logs every request with method, path, status code, and duration.
Useful for monitoring and debugging in production.
"""

import time
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = logging.getLogger("rag.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured access log for every HTTP request.
    Format: [REQUEST_ID] METHOD PATH → STATUS in Xms
    """

    SKIP_PATHS = {"/api/health"}  # Don't log health checks (too noisy)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        # Attach request ID so it can be used in route handlers
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000

            logger.info(
                f"[{request_id}] {request.method} {request.url.path} "
                f"→ {response.status_code} in {duration_ms:.1f}ms "
                f"| {request.client.host if request.client else 'unknown'}"
            )

            # Add request ID to response headers for debugging
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} "
                f"→ EXCEPTION in {duration_ms:.1f}ms: {exc}"
            )
            raise
