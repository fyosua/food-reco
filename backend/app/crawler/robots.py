"""Robots.txt parser and ToS checker for polite crawling."""

import time
from urllib.parse import urlparse

import httpx

_USER_AGENT = "FoodRecoBot/1.0 (+https://food.yosuaf.com; educational project)"


class RobotsChecker:
    """Minimal robots.txt checker — caches parsed rules per domain."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, bool]] = {}

    async def is_allowed(self, url: str) -> bool:
        """Check if crawling a URL is permitted by robots.txt."""
        parsed = urlparse(url)
        domain = parsed.netloc
        path = parsed.path or "/"

        if domain in self._cache:
            return self._cache[domain].get(path, True)

        # Fetch robots.txt
        robots_url = f"{parsed.scheme}://{domain}/robots.txt"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(robots_url, headers={"User-Agent": _USER_AGENT})
                if resp.status_code == 200:
                    rules = self._parse_robots(resp.text, path)
                else:
                    rules = {path: True}  # No robots.txt → allowed
        except Exception:
            rules = {path: True}  # Fetch failure → allow (conservative)

        self._cache[domain] = rules
        return rules.get(path, True)

    def _parse_robots(self, text: str, target_path: str) -> dict[str, bool]:
        """Simple robots.txt parser — supports User-agent and Disallow."""
        rules: dict[str, bool] = {}
        current_agent: str | None = None
        applicable = False

        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if line.lower().startswith("user-agent"):
                current_agent = line.split(":", 1)[1].strip()
                applicable = current_agent in ("*", _USER_AGENT)
            elif line.lower().startswith("disallow") and applicable:
                disallowed = line.split(":", 1)[1].strip()
                if disallowed == "/":
                    rules[target_path] = False
                elif target_path.startswith(disallowed):
                    rules[target_path] = False
                else:
                    rules[target_path] = True

        if not rules:
            rules[target_path] = True  # Default: allowed

        return rules