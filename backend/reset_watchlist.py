@'
import asyncio

from database import engine
from models import WatchlistItem


async def reset_watchlist_table():
    async with engine.begin() as conn:
        await conn.run_sync(WatchlistItem.__table__.drop, checkfirst=True)
        await conn.run_sync(WatchlistItem.__table__.create, checkfirst=True)

    print("watchlist_items table reset successfully.")


if __name__ == "__main__":
    asyncio.run(reset_watchlist_table())
'@ | Set-Content -Encoding UTF8 reset_watchlist.py