from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


CATEGORY_COLUMNS = [
    "item_class",
    "item_subclass",
    "goldsmith_category",
]


async def ensure_category_columns(
    conn: AsyncConnection,
    table_name: str,
) -> None:
    await conn.execute(
        text(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS item_class VARCHAR;
            """
        )
    )

    await conn.execute(
        text(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS item_subclass VARCHAR;
            """
        )
    )

    await conn.execute(
        text(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS goldsmith_category VARCHAR
            NOT NULL DEFAULT 'Unknown / Other';
            """
        )
    )


async def ensure_database_schema(conn: AsyncConnection) -> None:
    await ensure_category_columns(conn, "tracked_items")
    await ensure_category_columns(conn, "watchlist_items")
    await ensure_category_columns(conn, "price_snapshots")