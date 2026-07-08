import os
import time
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


class BlizzardAPIService:
    def __init__(self):
        self.client_id: Optional[str] = os.getenv("BLIZZARD_CLIENT_ID")
        self.client_secret: Optional[str] = os.getenv("BLIZZARD_CLIENT_SECRET")
        self.region: str = os.getenv("BLIZZARD_REGION", "us")
        self.namespace: str = os.getenv("BLIZZARD_NAMESPACE", f"dynamic-{self.region}")
        self.locale: str = os.getenv("BLIZZARD_LOCALE", "en_US")

        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _validate_credentials(self) -> None:
        if not self.client_id or not self.client_secret:
            raise RuntimeError(
                "Missing Blizzard API credentials. Check BLIZZARD_CLIENT_ID and "
                "BLIZZARD_CLIENT_SECRET in backend/.env"
            )

    async def get_token(self) -> str:
        self._validate_credentials()

        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        token_url = f"https://{self.region}.battle.net/oauth/token"

        print("[BLIZZARD AUTH] Requesting fresh OAuth token...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_url,
                data={"grant_type": "client_credentials"},
                auth=(self.client_id, self.client_secret),
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Blizzard OAuth failed. Status: {response.status_code}. "
                f"Response: {response.text}"
            )

        token_data = response.json()

        self._access_token = token_data["access_token"]
        self._token_expires_at = time.time() + token_data.get("expires_in", 86400)

        print("[BLIZZARD AUTH] OAuth token received.")

        return self._access_token

    async def get_auction_house_data(self, connected_realm_id: int) -> Dict[str, Any]:
        token = await self.get_token()

        url = (
            f"https://{self.region}.api.blizzard.com"
            f"/data/wow/connected-realm/{connected_realm_id}/auctions"
        )

        params = {
            "namespace": self.namespace,
            "locale": self.locale,
        }

        headers = {
            "Authorization": f"Bearer {token}",
        }

        print(
            "[BLIZZARD AUCTIONS] Fetching auctions for "
            f"connected_realm_id={connected_realm_id}, "
            f"region={self.region}, namespace={self.namespace}"
        )

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=headers,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Blizzard auction request failed. "
                f"Status: {response.status_code}. "
                f"URL: {response.url}. "
                f"Response: {response.text[:1000]}"
            )

        data = response.json()

        if "auctions" not in data:
            raise RuntimeError(
                f"Blizzard auction response did not contain 'auctions'. "
                f"Response keys: {list(data.keys())}"
            )

        print(
            "[BLIZZARD AUCTIONS] Auction download successful. "
            f"Auctions received: {len(data.get('auctions', []))}"
        )

        return data


blizzard_service = BlizzardAPIService()