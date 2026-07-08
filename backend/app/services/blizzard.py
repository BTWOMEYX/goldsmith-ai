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
    async def get_item_data(self, item_id: int) -> Dict[str, Any]:
        token = await self.get_token()

        url = (
            f"https://{self.region}.api.blizzard.com"
            f"/data/wow/item/{item_id}"
        )

        params = {
            "namespace": f"static-{self.region}",
            "locale": self.locale,
        }

        headers = {
            "Authorization": f"Bearer {token}",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=headers,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Blizzard item request failed for item_id={item_id}. "
                f"Status: {response.status_code}. Response: {response.text[:500]}"
            )

        return response.json()

    async def get_item_media(self, item_id: int) -> Dict[str, Any]:
        token = await self.get_token()

        url = (
            f"https://{self.region}.api.blizzard.com"
            f"/data/wow/media/item/{item_id}"
        )

        params = {
            "namespace": f"static-{self.region}",
            "locale": self.locale,
        }

        headers = {
            "Authorization": f"Bearer {token}",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=headers,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Blizzard item media request failed for item_id={item_id}. "
                f"Status: {response.status_code}. Response: {response.text[:500]}"
            )

        return response.json()

    async def get_item_display_data(self, item_id: int) -> Dict[str, Any]:
        item_name = f"Item {item_id}"
        item_quality = "unknown"
        icon_url = None

        try:
            item_data = await self.get_item_data(item_id)

            item_name = item_data.get("name", item_name)

            quality_data = item_data.get("quality", {})
            item_quality = quality_data.get("type", "unknown").lower()

        except Exception as error:
            print(f"[ITEM DATA WARNING] Could not fetch item data for {item_id}: {error}")

        try:
            media_data = await self.get_item_media(item_id)

            assets = media_data.get("assets", [])

            for asset in assets:
                if asset.get("key") == "icon":
                    icon_url = asset.get("value")
                    break

        except Exception as error:
            print(f"[ITEM MEDIA WARNING] Could not fetch item media for {item_id}: {error}")

        return {
            "item_id": item_id,
            "name": item_name,
            "quality": item_quality,
            "icon_url": icon_url,
        }

blizzard_service = BlizzardAPIService()