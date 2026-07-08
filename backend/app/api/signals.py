from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import PriceSnapshot, WatchlistItem

router = APIRouter(
    prefix="/api",
    tags=["Signals"],
)


REALM_NAMES = {
    11: "Illidan",
    4: "Area 52",
    12: "Sargeras",
    53: "Tichondrius",
}


def calculate_percent_change(
    current_value: float,
    previous_value: float | None,
) -> float:
    if previous_value is None or previous_value <= 0:
        return 0.0

    return round(((current_value - previous_value) / previous_value) * 100, 2)


def calculate_signal_confidence(
    opportunity_score: float,
    volume: int,
    listing_count: int,
    risk_level: str,
    price_change_percent: float,
    score_change: float,
) -> float:
    confidence = 35.0

    confidence += min(opportunity_score / 100, 1) * 30
    confidence += min(volume / 100, 1) * 15
    confidence += min(listing_count / 40, 1) * 10

    if risk_level.lower() == "low":
        confidence += 10
    elif risk_level.lower() == "medium":
        confidence += 5
    elif risk_level.lower() == "high":
        confidence -= 10

    if price_change_percent <= -5:
        confidence += 8

    if score_change >= 5:
        confidence += 7

    return round(max(1, min(confidence, 100)), 1)


def build_signal(
    opportunity_score: float,
    risk_level: str,
    volume: int,
    listing_count: int,
    price_change_percent: float,
    score_change: float,
) -> dict:
    risk = risk_level.lower()

    if (
        opportunity_score >= 75
        and risk in ["low", "medium"]
        and volume >= 25
        and listing_count >= 8
        and price_change_percent <= -3
    ):
        return {
            "signal": "STRONG_BUY",
            "label": "Strong Buy",
            "priority": 1,
            "action": "High-priority buy candidate. Review market depth before acting.",
            "tone": "strong",
        }

    if (
        opportunity_score >= 60
        and risk in ["low", "medium"]
        and volume >= 20
        and listing_count >= 6
    ):
        return {
            "signal": "BUY_WATCH",
            "label": "Buy Watch",
            "priority": 2,
            "action": "Worth watching closely. Good score with usable market depth.",
            "tone": "positive",
        }

    if price_change_percent <= -10 and opportunity_score >= 45:
        return {
            "signal": "PRICE_DROP",
            "label": "Price Drop",
            "priority": 3,
            "action": "Price has dropped sharply. Check if this is a buying window.",
            "tone": "positive",
        }

    if score_change >= 8 and opportunity_score >= 50:
        return {
            "signal": "SCORE_IMPROVING",
            "label": "Score Improving",
            "priority": 4,
            "action": "Opportunity score is improving. Monitor for confirmation.",
            "tone": "positive",
        }

    if risk == "high" and opportunity_score < 55:
        return {
            "signal": "AVOID",
            "label": "Avoid",
            "priority": 6,
            "action": "Risk is high and the score is not strong enough to justify action.",
            "tone": "negative",
        }

    return {
        "signal": "HOLD",
        "label": "Hold",
        "priority": 5,
        "action": "No urgent action. Keep monitoring future snapshots.",
        "tone": "neutral",
    }


def build_signal_reason(
    signal_label: str,
    opportunity_score: float,
    risk_level: str,
    volume: int,
    listing_count: int,
    price_change_percent: float,
    score_change: float,
) -> str:
    return (
        f"{signal_label}: score {opportunity_score}/100, "
        f"{risk_level.lower()} risk, {volume} quantity across "
        f"{listing_count} listings, price movement {price_change_percent}%, "
        f"score movement {score_change}."
    )


def serialize_signal_item(
    snapshots: list[PriceSnapshot],
    watched_item_ids: set[tuple[int, int]] | None = None,
) -> dict:
    latest = snapshots[0]
    previous = snapshots[1] if len(snapshots) > 1 else None

    previous_price = previous.current_price if previous else None
    previous_score = previous.opportunity_score if previous else None
    previous_volume = previous.volume if previous else None

    price_change = 0.0
    score_change = 0.0
    volume_change = 0

    if previous:
        price_change = round(latest.current_price - previous.current_price, 2)
        score_change = round(
            latest.opportunity_score - previous.opportunity_score,
            2,
        )
        volume_change = latest.volume - previous.volume

    price_change_percent = calculate_percent_change(
        latest.current_price,
        previous_price,
    )

    volume_change_percent = calculate_percent_change(
        float(latest.volume),
        float(previous_volume) if previous_volume is not None else None,
    )

    signal_data = build_signal(
        opportunity_score=latest.opportunity_score,
        risk_level=latest.risk_level,
        volume=latest.volume,
        listing_count=latest.listing_count,
        price_change_percent=price_change_percent,
        score_change=score_change,
    )

    confidence = calculate_signal_confidence(
        opportunity_score=latest.opportunity_score,
        volume=latest.volume,
        listing_count=latest.listing_count,
        risk_level=latest.risk_level,
        price_change_percent=price_change_percent,
        score_change=score_change,
    )

    watched_key = (latest.realm_id, latest.item_id)
    is_watched = watched_key in watched_item_ids if watched_item_ids else False

    return {
        "item_id": latest.item_id,
        "realm_id": latest.realm_id,
        "realm_name": latest.realm_name,
        "name": latest.name,
        "current_price": latest.current_price,
        "previous_price": previous_price,
        "price_change": price_change,
        "price_change_percent": price_change_percent,
        "volume": latest.volume,
        "previous_volume": previous_volume,
        "volume_change": volume_change,
        "volume_change_percent": volume_change_percent,
        "listing_count": latest.listing_count,
        "opportunity_score": latest.opportunity_score,
        "previous_score": previous_score,
        "score_change": score_change,
        "risk_level": latest.risk_level,
        "reason": latest.reason,
        "icon_url": latest.icon_url,
        "quality": latest.quality,
        "snapshot_count": len(snapshots),
        "last_seen": latest.created_at.isoformat()
        if latest.created_at
        else None,
        "signal": signal_data["signal"],
        "signal_label": signal_data["label"],
        "signal_priority": signal_data["priority"],
        "signal_action": signal_data["action"],
        "signal_tone": signal_data["tone"],
        "signal_confidence": confidence,
        "signal_reason": build_signal_reason(
            signal_label=signal_data["label"],
            opportunity_score=latest.opportunity_score,
            risk_level=latest.risk_level,
            volume=latest.volume,
            listing_count=latest.listing_count,
            price_change_percent=price_change_percent,
            score_change=score_change,
        ),
        "is_watched": is_watched,
    }


async def load_watched_item_ids(db: AsyncSession) -> set[tuple[int, int]]:
    result = await db.execute(select(WatchlistItem))

    watchlist_items = result.scalars().all()

    return {
        (item.realm_id, item.item_id)
        for item in watchlist_items
    }


async def load_grouped_snapshots(
    connected_realm_id: int,
    limit: int,
    db: AsyncSession,
) -> dict[int, list[PriceSnapshot]]:
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

    return grouped_snapshots


def build_signal_summary(items: list[dict]) -> dict:
    return {
        "strong_buy_count": len(
            [item for item in items if item["signal"] == "STRONG_BUY"]
        ),
        "buy_watch_count": len(
            [item for item in items if item["signal"] == "BUY_WATCH"]
        ),
        "price_drop_count": len(
            [item for item in items if item["signal"] == "PRICE_DROP"]
        ),
        "score_improving_count": len(
            [item for item in items if item["signal"] == "SCORE_IMPROVING"]
        ),
        "hold_count": len(
            [item for item in items if item["signal"] == "HOLD"]
        ),
        "avoid_count": len(
            [item for item in items if item["signal"] == "AVOID"]
        ),
    }


@router.get("/signals")
async def get_signals(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    try:
        watched_item_ids = await load_watched_item_ids(db)

        grouped_snapshots = await load_grouped_snapshots(
            connected_realm_id=connected_realm_id,
            limit=limit,
            db=db,
        )

        signal_items = [
            serialize_signal_item(
                snapshots=item_snapshots,
                watched_item_ids=watched_item_ids,
            )
            for item_snapshots in grouped_snapshots.values()
        ]

        signal_items.sort(
            key=lambda item: (
                item["signal_priority"],
                -item["signal_confidence"],
                -item["opportunity_score"],
            )
        )

        top_signal = signal_items[0] if signal_items else None

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": REALM_NAMES.get(
                connected_realm_id,
                f"Connected Realm {connected_realm_id}",
            ),
            "signal_count": len(signal_items),
            "top_signal": top_signal,
            "summary": build_signal_summary(signal_items),
            "items": signal_items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
        }


@router.get("/signals/watchlist")
async def get_watchlist_signals(
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    try:
        watched_item_ids = await load_watched_item_ids(db)

        if not watched_item_ids:
            return {
                "status": "Success",
                "signal_count": 0,
                "top_signal": None,
                "summary": build_signal_summary([]),
                "items": [],
            }

        result = await db.execute(
            select(PriceSnapshot)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(limit)
        )

        snapshots = result.scalars().all()

        grouped_snapshots: dict[tuple[int, int], list[PriceSnapshot]] = {}

        for snapshot in snapshots:
            key = (snapshot.realm_id, snapshot.item_id)

            if key not in watched_item_ids:
                continue

            if key not in grouped_snapshots:
                grouped_snapshots[key] = []

            grouped_snapshots[key].append(snapshot)

        signal_items = [
            serialize_signal_item(
                snapshots=item_snapshots,
                watched_item_ids=watched_item_ids,
            )
            for item_snapshots in grouped_snapshots.values()
        ]

        signal_items.sort(
            key=lambda item: (
                item["signal_priority"],
                -item["signal_confidence"],
                -item["opportunity_score"],
            )
        )

        top_signal = signal_items[0] if signal_items else None

        return {
            "status": "Success",
            "signal_count": len(signal_items),
            "top_signal": top_signal,
            "summary": build_signal_summary(signal_items),
            "items": signal_items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "error": str(error),
        }


@router.get("/signals/item/{realm_id}/{item_id}")
async def get_item_signal(
    realm_id: int,
    item_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        watched_item_ids = await load_watched_item_ids(db)

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

        if not snapshots:
            return {
                "status": "Not Found",
                "realm_id": realm_id,
                "item_id": item_id,
                "item": None,
            }

        item = serialize_signal_item(
            snapshots=snapshots,
            watched_item_ids=watched_item_ids,
        )

        return {
            "status": "Success",
            "realm_id": realm_id,
            "item_id": item_id,
            "item": item,
        }

    except Exception as error:
        return {
            "status": "Error",
            "realm_id": realm_id,
            "item_id": item_id,
            "error": str(error),
        }