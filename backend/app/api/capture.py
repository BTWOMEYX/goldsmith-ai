from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import MarketSnapshot

router = APIRouter(
    prefix="/api",
    tags=["Market Capture"],
)


def serialize_market_snapshot(snapshot: MarketSnapshot) -> dict:
    return {
        "id": snapshot.id,
        "item_id": snapshot.item_id,
        "realm_id": snapshot.realm_id,
        "realm_name": snapshot.realm_name,
        "scan_mode": snapshot.scan_mode,
        "min_price": snapshot.min_price,
        "average_price": snapshot.average_price,
        "total_market_value": snapshot.total_market_value,
        "volume": snapshot.volume,
        "listing_count": snapshot.listing_count,
        "created_at": snapshot.created_at.isoformat()
        if snapshot.created_at
        else None,
    }


@router.get("/capture/summary")
async def get_capture_summary(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        latest_timestamp_result = await db.execute(
            select(func.max(MarketSnapshot.created_at)).where(
                MarketSnapshot.realm_id == connected_realm_id
            )
        )

        latest_timestamp = latest_timestamp_result.scalar()

        if not latest_timestamp:
            return {
                "status": "Success",
                "connected_realm_id": connected_realm_id,
                "realm": f"Connected Realm {connected_realm_id}",
                "latest_capture_at": None,
                "item_count": 0,
                "total_volume": 0,
                "total_market_value": 0,
                "items": [],
            }

        result = await db.execute(
            select(MarketSnapshot)
            .where(
                MarketSnapshot.realm_id == connected_realm_id,
                MarketSnapshot.created_at == latest_timestamp,
            )
            .order_by(
                MarketSnapshot.total_market_value.desc(),
                MarketSnapshot.volume.desc(),
            )
            .limit(100)
        )

        snapshots = result.scalars().all()

        total_result = await db.execute(
            select(
                func.count(MarketSnapshot.id),
                func.coalesce(func.sum(MarketSnapshot.volume), 0),
                func.coalesce(func.sum(MarketSnapshot.total_market_value), 0),
            ).where(
                MarketSnapshot.realm_id == connected_realm_id,
                MarketSnapshot.created_at == latest_timestamp,
            )
        )

        total_row = total_result.one()

        realm_name = snapshots[0].realm_name if snapshots else (
            f"Connected Realm {connected_realm_id}"
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "latest_capture_at": latest_timestamp.isoformat(),
            "item_count": total_row[0],
            "total_volume": int(total_row[1] or 0),
            "total_market_value": float(total_row[2] or 0),
            "items": [
                serialize_market_snapshot(snapshot)
                for snapshot in snapshots
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
        }


@router.get("/capture/item/{realm_id}/{item_id}")
async def get_capture_item_history(
    realm_id: int,
    item_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(MarketSnapshot)
            .where(
                MarketSnapshot.realm_id == realm_id,
                MarketSnapshot.item_id == item_id,
            )
            .order_by(MarketSnapshot.created_at.desc())
            .limit(limit)
        )

        snapshots = result.scalars().all()

        return {
            "status": "Success",
            "realm_id": realm_id,
            "item_id": item_id,
            "snapshot_count": len(snapshots),
            "items": [
                serialize_market_snapshot(snapshot)
                for snapshot in snapshots
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "realm_id": realm_id,
            "item_id": item_id,
            "error": str(error),
        }