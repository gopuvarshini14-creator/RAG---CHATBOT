"""
Authentication Middleware
Supports HTTP Basic Auth and API Key authentication.
Enable via ENABLE_AUTH=true in .env

Usage in routes:
    @router.get("/protected", dependencies=[Depends(require_auth)])
    async def protected_route(): ...
"""

import secrets
import logging
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials, APIKeyHeader
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# HTTP Basic Auth scheme
basic_scheme = HTTPBasic(auto_error=False)

# API Key header scheme (X-API-Key: your-key)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_basic_auth(credentials: HTTPBasicCredentials) -> bool:
    """Constant-time comparison to prevent timing attacks"""
    correct_user = secrets.compare_digest(
        credentials.username.encode("utf-8"),
        settings.AUTH_USERNAME.encode("utf-8")
    )
    correct_pass = secrets.compare_digest(
        credentials.password.encode("utf-8"),
        settings.AUTH_PASSWORD.encode("utf-8")
    )
    return correct_user and correct_pass


def verify_api_key(api_key: str) -> bool:
    """Verify API key — extend this to check a database"""
    if not settings.API_KEYS:
        return False
    return any(
        secrets.compare_digest(api_key.encode(), key.encode())
        for key in settings.API_KEYS
    )


async def require_auth(
    request: Request,
    credentials: Optional[HTTPBasicCredentials] = Depends(basic_scheme),
    api_key: Optional[str] = Depends(api_key_header),
):
    """
    Dependency that enforces authentication when ENABLE_AUTH=true.
    Accepts either HTTP Basic Auth OR an X-API-Key header.
    If auth is disabled, allows all requests through.
    """
    if not settings.ENABLE_AUTH:
        return  # Auth disabled — allow everything

    # Try API key first
    if api_key and verify_api_key(api_key):
        logger.info(f"API key auth successful for {request.client.host}")
        return

    # Try Basic Auth
    if credentials and verify_basic_auth(credentials):
        logger.info(f"Basic auth successful for user '{credentials.username}'")
        return

    # Both failed
    logger.warning(f"Auth failed for {request.client.host} {request.url.path}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Basic"},
    )


# Convenience: use as a router-level dependency
AuthDep = Depends(require_auth)
