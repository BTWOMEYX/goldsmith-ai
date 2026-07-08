from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import PriceSnapshot

router = APIRouter(
    prefix="/api",
    tags=["History"],
)


REALM_NAMES = {
    11: "Illidan",
    4: "Area 52",
    12: "Sargeras",
    53: "Tichondrius",
}


def serialize_snapshot(snapshot: PriceSnapshot) -> dict:
    return {
        "id": snapshot.id,
        "item_id": snapshot.item_id,
        "realm_id": snapshot.realm_id,
        "realm_name": snapshot.realm_name,
        "name": snapshot.name,
        "current_price": snapshot.current_price,
        "volume": snapshot.volume,
        "listing_count": snapshot.listing_count,
        "opportunity_score": snapshot.opportunity_score,
        "risk_level": snapshot.risk_level,
        "reason": snapshot.reason,
        "icon_url": snapshot.icon_url,
        "quality": snapshot.quality,
        "profit_margin": snapshot.profit_margin,
        "created_at": snapshot.created_at.isoformat()
        if snapshot.created_at
        else None,
    }


def build_summary_item(snapshots: list[PriceSnapshot]) -> dict:
    latest = snapshots[0]
    previous = snapshots[1] if len(snapshots) > 1 else None

    previous_price = previous.current_price if previous else None
    previous_score = previous.opportunity_score if previous else None

    price_change = 0.0
    price_change_percent = 0.0
    score_change = 0.0

    if previous and previous.current_price > 0:
        price_change = latest.current_price - previous.current_price
        price_change_percent = (price_change / previous.current_price) * 100

    if previous:
        score_change = latest.opportunity_score - previous.opportunity_score

    return {
        "item_id": latest.item_id,
        "realm_id": latest.realm_id,
        "realm_name": latest.realm_name,
        "name": latest.name,
        "current_price": latest.current_price,
        "previous_price": previous_price,
        "price_change": round(price_change, 2),
        "price_change_percent": round(price_change_percent, 2),
        "opportunity_score": latest.opportunity_score,
        "previous_score": previous_score,
        "score_change": round(score_change, 2),
        "volume": latest.volume,
        "listing_count": latest.listing_count,
        "risk_level": latest.risk_level,
        "reason": latest.reason,
        "icon_url": latest.icon_url,
        "quality": latest.quality,
        "snapshot_count": len(snapshots),
        "last_seen": latest.created_at.isoformat()
        if latest.created_at
        else None,
    }


@router.get("/history")
async def get_history(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.realm_id == connected_realm_id)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(limit)
        )

        snapshots = result.scalars().all()

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": REALM_NAMES.get(
                connected_realm_id,
                f"Connected Realm {connected_realm_id}",
            ),
            "snapshot_count": len(snapshots),
            "items": [
                serialize_snapshot(snapshot)
                for snapshot in snapshots
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
        }


@router.get("/history/summary")
async def get_history_summary(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.realm_id == connected_realm_id)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(limit)
        )

        snapshots = result.scalars().all()

        grouped_snapshots: dict[int, list[PriceSnapshot]] = {}

        for snapshot in snapshots:
            if snapshot.item_id not in grouped_snapshots:
                grouped_snapshots[snapshot.item_id] = []

            grouped_snapshots[snapshot.item_id].append(snapshot)

        summary_items = [
            build_summary_item(item_snapshots)
            for item_snapshots in grouped_snapshots.values()
        ]

        summary_items.sort(
            key=lambda item: (
                abs(item["price_change_percent"]),
                item["opportunity_score"],
            ),
            reverse=True,
        )

        movers = [
            item
            for item in summary_items
            if item["snapshot_count"] > 1
        ]

        biggest_gain = None
        biggest_drop = None

        if movers:
            biggest_gain = max(
                movers,
                key=lambda item: item["price_change_percent"],
            )

            biggest_drop = min(
                movers,
                key=lambda item: item["price_change_percent"],
            )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": REALM_NAMES.get(
                connected_realm_id,
                f"Connected Realm {connected_realm_id}",
            ),
            "snapshot_count": len(snapshots),
            "tracked_item_count": len(summary_items),
            "mover_count": len(movers),
            "biggest_gain": biggest_gain,
            "biggest_drop": biggest_drop,
            "items": summary_items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
        }


@router.get("/history/item/{realm_id}/{item_id}")
async def get_item_history(
    realm_id: int,
    item_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(PriceSnapshot)
            .where(
                PriceSnapshot.realm_id == realm_id,
                PriceSnapshot.item_id == item_id,
            )
            .order_by(PriceSnapshot.created_at.desc())
            .limit(limit)
        )

        snapshots = result.scalars().all()

        return {
            "status": "Success",
            "realm_id": realm_id,
            "item_id": item_id,
            "snapshot_count": len(snapshots),
            "items": [
                serialize_snapshot(snapshot)
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