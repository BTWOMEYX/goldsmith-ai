import asyncio

from database import engine
from models import PriceSnapshot


async def reset_price_history_table():
    async with engine.begin() as conn:
        await conn.run_sync(PriceSnapshot.__table__.drop, checkfirst=True)
        await conn.run_sync(PriceSnapshot.__table__.create, checkfirst=True)

    print("price_snapshots table reset successfully.")


if __name__ == "__main__":
    asyncio.run(reset_price_history_table())