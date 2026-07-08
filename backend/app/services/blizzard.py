import os
import time
import httpx
from typing import Optional, Dict, Any

class BlizzardAPIService:
    def __init__(self):
        self.client_id: Optional[str] = None
        self.client_secret: Optional[str] = None
        self.region: str = "us"
        
        # In-memory token cache mechanics to prevent unnecessary rate-limit spikes
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _load_credentials(self) -> None:
        """
        Dynamically extracts secrets from the environment variables.
        """
        self.client_id = os.getenv("BLIZZARD_CLIENT_ID")
        self.client_secret = os.getenv("BLIZZARD_CLIENT_SECRET")
        self.region = os.getenv("BLIZZARD_REGION", "us")

        if not self.client_id or not self.client_secret:
            print("[BLIZZARD SERVICE CRITICAL ERROR] BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET is missing from your .env configuration.")

    async def get_token(self) -> str:
        """
        Retrieves a valid OAuth2 Access Token using the client credentials grant flow.
        Utilizes local system cache expiration metrics to auto-renew when stale.
        """
        # Ensure latest credentials are read
        if not self.client_id:
            self._load_credentials()

        # Return cached token instantly if it's still alive (with a 60-second cushion buffer)
        if self._access_token and time.time() < (self._token_expires_at - 60):
            return self._access_token

        print("[BLIZZARD AUTH] Token missing or expired. Requesting fresh OAuth2 lease...")
        token_url = f"https://{self.region}.battle.net/oauth/token"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    token_url,
                    data={"grant_type": "client_credentials"},
                    auth=(self.client_id, self.client_secret),
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"Blizzard Auth Rejected Request: {response.text}")
                    
                token_data = response.json()
                self._access_token = token_data["access_token"]
                
                # Blizzard tokens typically last 24 hours (86400 seconds)
                expires_in = token_data.get("expires_in", 86400)
                self._token_expires_at = time.time() + expires_in
                
                print("[BLIZZARD AUTH] Authentication handshake verified successfully.")
                return self._access_token

            except Exception as e:
                print(f"[BLIZZARD AUTH EXCEPTION] Failed to retrieve access credentials: {str(e)}")
                raise e

    async def get_auction_house_data(self, connected_realm_id: int) -> Dict[str, Any]:
        """
        Fetches the complete real-time auction house dataset matching the correct connected realm shard.
        """
        token = await self.get_token()
        
        # CORRECT LIVE URL PATH ROUTING MAPPING
        url = f"https://{self.region}.api.blizzard.com/data/wow/connected-realm/{connected_realm_id}/auctions"
        
        params = {
            "namespace": f"dynamic-{self.region}",
            "locale": "en_US",
            "access_token": token
        }

        print(f"[BLIZZARD ENGINE] Initializing secure data download stream from: {url}")
        
        async with httpx.AsyncClient() as client:
            try:
                # Setting an extended 30s timeout since auction dumps can be up to 50MB+ of pure text array data
                response = await client.get(url, params=params, timeout=30.0)
                
                if response.status_code == 404:
                    print(f"[BLIZZARD SERVICE 404] Shard index {connected_realm_id} does not exist inside Blizzard's dynamic namespace framework.")
                    raise httpx.HTTPStatusError(
                        f"Client error '404 Not Found' for url '{response.url}'",
                        request=response.request,
                        response=response
                    )
                    
                response.raise_for_status()
                return response.json()
                
            except httpx.HTTPStatusError as http_err:
                print(f"[BLIZZARD NETWORK ERROR] Shard connection failed with status: {http_err.response.status_code}")
                raise http_err
            except Exception as e:
                print(f"[BLIZZARD ENGINE EXCEPTION] Failed to pull auction stream: {str(e)}")
                raise e

# Export a unified reference singleton instance for all feature route controllers to share
blizzard_service = BlizzardAPIService()