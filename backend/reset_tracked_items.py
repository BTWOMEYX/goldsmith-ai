import asyncio

from database import engine
from models import TrackedItem


async def reset_tracked_items_table():
    async with engine.begin() as conn:
        await conn.run_sync(TrackedItem.__table__.drop, checkfirst=True)
        await conn.run_sync(TrackedItem.__table__.create, checkfirst=True)

    print("tracked_items table reset successfully.")


if __name__ == "__main__":
    asyncio.run(reset_tracked_items_table())