"""
Retry Utilities
Exponential backoff retry decorator for unreliable external calls (OpenAI API).

OpenAI errors to retry:
- RateLimitError (429): Wait and retry
- APITimeoutError: Retry immediately
- APIConnectionError: Network issue, retry
- InternalServerError (500): OpenAI issue, retry

Do NOT retry:
- AuthenticationError (401): Bad API key
- InvalidRequestError (400): Bad input
"""

import asyncio
import logging
import time
import functools
from typing import TypeVar, Callable, Any

logger = logging.getLogger(__name__)

T = TypeVar("T")


def retry_async(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = None,
):
    """
    Async retry decorator with exponential backoff.

    Args:
        max_attempts: Total number of attempts (including first try)
        initial_delay: Wait time in seconds after first failure
        max_delay: Cap on wait time
        backoff_factor: Multiply delay by this after each failure
        retryable_exceptions: Tuple of exception types to retry on.
                               If None, retries on all exceptions.

    Usage:
        @retry_async(max_attempts=3, initial_delay=1.0)
        async def call_openai():
            return await client.embeddings.create(...)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)

                except Exception as exc:
                    last_exception = exc
                    exc_name = type(exc).__name__

                    # Check if we should retry this exception type
                    if retryable_exceptions and not isinstance(exc, retryable_exceptions):
                        logger.error(f"Non-retryable error in {func.__name__}: {exc}")
                        raise

                    if attempt == max_attempts:
                        logger.error(
                            f"{func.__name__} failed after {max_attempts} attempts: {exc}"
                        )
                        raise

                    # Check for OpenAI rate limit with Retry-After header
                    retry_after = _get_retry_after(exc)
                    wait_time = retry_after if retry_after else min(delay, max_delay)

                    logger.warning(
                        f"{func.__name__} attempt {attempt}/{max_attempts} failed "
                        f"({exc_name}). Retrying in {wait_time:.1f}s..."
                    )

                    await asyncio.sleep(wait_time)
                    delay *= backoff_factor

            raise last_exception

        return wrapper
    return decorator


def _get_retry_after(exc: Exception) -> float | None:
    """Extract Retry-After value from OpenAI rate limit exceptions"""
    # openai.RateLimitError may include retry_after in headers
    if hasattr(exc, "response") and exc.response is not None:
        retry_after = exc.response.headers.get("retry-after")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
    return None


# ─── Pre-configured decorators ───────────────────────────────

def openai_retry(func):
    """
    Standard retry for OpenAI API calls.
    3 attempts, starting at 2s, capped at 30s.
    """
    try:
        from openai import RateLimitError, APITimeoutError, APIConnectionError, InternalServerError
        retryable = (RateLimitError, APITimeoutError, APIConnectionError, InternalServerError)
    except ImportError:
        retryable = None  # Retry on all exceptions if openai not importable

    return retry_async(
        max_attempts=3,
        initial_delay=2.0,
        max_delay=30.0,
        backoff_factor=2.0,
        retryable_exceptions=retryable,
    )(func)
