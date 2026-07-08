import os
import httpx
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from dotenv import dotenv_values

# 1. Get the absolute path to the .env file
env_path = Path(__file__).resolve().parent.parent.parent / ".env"

# 2. Read the file directly into a dictionary (bypassing os.environ issues)
config = dotenv_values(env_path)

class BlizzardAPIService:
    def __init__(self):
        # 3. Pull directly from our dictionary
        self.client_id = config.get("BLIZZARD_CLIENT_ID")
        self.client_secret = config.get("BLIZZARD_CLIENT_SECRET")
        self.region = config.get("BLIZZARD_REGION", "us")
        
        # 4. Detailed error if it still fails, so we know EXACTLY why
        if not self.client_id or not self.client_secret:
            raise ValueError(f"🚨 Keys missing! Looked for .env at: {env_path} | File Exists: {env_path.exists()}")
            
        self.token: Optional[str] = None
        self.token_expires: Optional[datetime] = None

    async def get_access_token(self) -> str:
        if self.token and self.token_expires and datetime.utcnow() < self.token_expires:
            return self.token

        url = "https://oauth.battle.net/token"
        data = {"grant_type": "client_credentials"}
        auth = (self.client_id, self.client_secret)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=data, auth=auth)
                response.raise_for_status()
                res_data = response.json()
                
                self.token = res_data["access_token"]
                expires_in = res_data.get("expires_in", 86400) - 60
                self.token_expires = datetime.utcnow() + timedelta(seconds=expires_in)
                
                print("Successfully authenticated with Blizzard OAuth! 🔑")
                return self.token
            except httpx.HTTPStatusError as e:
                print(f"Blizzard Auth Failed: {e.response.status_code} - {e.response.text}")
                raise e

    async def get_auction_house_data(self, connected_realm_id: int = 11) -> dict:
        token = await self.get_access_token()
        
        base_url = f"https://{self.region}.api.blizzard.com"
        endpoint = f"/data/wow/connected-realm/{connected_realm_id}/auctions"
        
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "namespace": f"dynamic-{self.region}",
            "locale": "en_US"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}{endpoint}", headers=headers, params=params, timeout=60.0)
            response.raise_for_status()
            return response.json()

blizzard_service = BlizzardAPIService()