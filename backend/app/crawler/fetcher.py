"""HTTP fetcher with polite crawling — rate-limited, robots-respecting."""

import hashlib
import time
from datetime import datetime, timezone

import httpx

from app.crawler.robots import RobotsChecker

_USER_AGENT = "FoodRecoBot/1.0 (+https://food.yosuaf.com; educational project)"
_DEFAULT_DELAY = 1.0  # seconds between requests to the same domain


class PoliteFetcher:
    """Polite HTTP fetcher that respects robots.txt and rate-limits per domain."""

    def __init__(self, delay: float = _DEFAULT_DELAY) -> None:
        self._robots = RobotsChecker()
        self._last_fetch: dict[str, float] = {}
        self._delay = delay
        self._client = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        )

    async def fetch(self, url: str) -> dict:
        """Fetch a URL politely. Returns dict with status, content, hash, and timing."""
        parsed = __import__("urllib.parse").urlparse(url)
        domain = parsed.netloc

        # Check robots.txt
        allowed = await self._robots.is_allowed(url)
        if not allowed:
            return {
                "status": "blocked",
                "url": url,
                "reason": "Disallowed by robots.txt",
                "content": None,
                "hash": None,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }

        # Rate limit per domain
        last = self._last_fetch.get(domain, 0.0)
        elapsed = time.time() - last
        if elapsed < self._delay:
            await self._wait(self._delay - elapsed)

        try:
            resp = await self._client.get(url)
            self._last_fetch[domain] = time.time()

            if resp.status_code != 200:
                return {
                    "status": "error",
                    "url": url,
                    "reason": f"HTTP {resp.status_code}",
                    "content": None,
                    "hash": None,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }

            content = resp.text
            raw_hash = hashlib.sha256(content.encode()).hexdigest()

            return {
                "status": "fetched",
                "url": url,
                "reason": None,
                "content": content,
                "hash": raw_hash,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }

        except httpx.TimeoutException:
            return {"status": "error", "url": url, "reason": "Timeout", "content": None, "hash": None, "fetched_at": datetime.now(timezone.utc).isoformat()}
        except httpx.RequestError as e:
            return {"status": "error", "url": url, "reason": str(e), "content": None, "hash": None, "fetched_at": datetime.now(timezone.utc).isoformat()}

    async def _wait(self, seconds: float) -> None:
        """Async wait helper."""
        await self._async_sleep(seconds)

    @staticmethod
    async def _async_sleep(seconds: float) -> None:
        """Sleep without blocking the event loop."""
        import asyncio
        await asyncio.sleep(seconds)

    async def close(self) -> None:
        await self._client.aclose()