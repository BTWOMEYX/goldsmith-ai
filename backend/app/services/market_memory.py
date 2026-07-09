from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean, pstdev

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import PriceSnapshot


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default

        return float(value)
    except Exception:
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None:
            return default

        return int(value)
    except Exception:
        return default


def _get_value(item, field_name: str, default=None):
    if isinstance(item, dict):
        return item.get(field_name, default)

    return getattr(item, field_name, default)


def _normalise_datetime(value) -> datetime | None:
    if not value:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def _percent_difference(current: float, baseline: float | None) -> float:
    if baseline is None or baseline <= 0:
        return 0.0

    return round(((current - baseline) / baseline) * 100, 2)


def _price_position(current: float, low: float, high: float) -> float:
    if high <= low:
        return 50.0

    return round(((current - low) / (high - low)) * 100, 1)


def empty_market_memory(
    item_id: int | None = None,
    current_price: float | None = None,
) -> dict:
    return {
        "item_id": item_id,
        "sample_count": 0,
        "latest_price": current_price,
        "average_7_day_price": None,
        "average_30_day_price": None,
        "lowest_30_day_price": None,
        "highest_30_day_price": None,
        "average_7_day_volume": None,
        "average_30_day_volume": None,
        "average_7_day_listing_count": None,
        "average_30_day_listing_count": None,
        "current_vs_7_day_average_percent": 0.0,
        "current_vs_30_day_average_percent": 0.0,
        "price_position_30_day_percent": 50.0,
        "volatility_score": 0.0,
        "price_state": "Learning",
        "memory_score": 50.0,
        "memory_confidence": "Low",
        "memory_note": "Not enough historical snapshots yet. Let AutoPilot collect more data.",
    }


def classify_price_state(
    sample_count: int,
    current_vs_7: float,
    current_vs_30: float,
    price_position: float,
    volatility_score: float,
) -> str:
    if sample_count < 3:
        return "Learning"

    if volatility_score >= 65:
        return "Volatile"

    if current_vs_30 <= -30 or (current_vs_7 <= -18 and price_position <= 20):
        return "Deep Undervalued"

    if current_vs_30 <= -15 or current_vs_7 <= -12 or price_position <= 25:
        return "Undervalued"

    if current_vs_30 >= 25 or current_vs_7 >= 18 or price_position >= 85:
        return "Overpriced"

    if price_position <= 35:
        return "Below Normal"

    if price_position >= 70:
        return "Above Normal"

    return "Fair Value"


def calculate_memory_score(
    price_state: str,
    sample_count: int,
    volatility_score: float,
    current_vs_30: float,
    price_position: float,
) -> float:
    score = 50.0

    if price_state == "Deep Undervalued":
        score += 35
    elif price_state == "Undervalued":
        score += 22
    elif price_state == "Below Normal":
        score += 10
    elif price_state == "Fair Value":
        score += 0
    elif price_state == "Above Normal":
        score -= 8
    elif price_state == "Overpriced":
        score -= 25
    elif price_state == "Volatile":
        score -= 15
    elif price_state == "Learning":
        score -= 5

    if sample_count >= 10:
        score += 8
    elif sample_count >= 5:
        score += 4
    elif sample_count < 3:
        score -= 12

    if volatility_score >= 65:
        score -= 20
    elif volatility_score >= 40:
        score -= 8
    elif volatility_score <= 18 and sample_count >= 5:
        score += 6

    if current_vs_30 <= -25 and price_position <= 25:
        score += 8

    return round(max(1, min(score, 100)), 1)


def get_memory_confidence(sample_count: int) -> str:
    if sample_count >= 12:
        return "High"

    if sample_count >= 5:
        return "Medium"

    return "Low"


def build_memory_note(
    price_state: str,
    sample_count: int,
    current_vs_30: float,
    volatility_score: float,
) -> str:
    if sample_count < 3:
        return "GoldSmith is still learning this item. Use smaller positions until more scans are collected."

    if price_state == "Deep Undervalued":
        return f"Current price is deeply below normal by {abs(current_vs_30):.1f}% against recent memory."

    if price_state == "Undervalued":
        return f"Current price is below normal by {abs(current_vs_30):.1f}%."

    if price_state == "Overpriced":
        return f"Current price is above normal by {current_vs_30:.1f}%. Avoid buying unless there is a special reason."

    if price_state == "Volatile":
        return f"Price history is unstable with volatility score {volatility_score:.1f}. Reduce quantity and exposure."

    if price_state == "Below Normal":
        return "Price is below its recent range, but not extreme."

    if price_state == "Above Normal":
        return "Price is above its recent range. Watch instead of buying aggressively."

    return "Price is close to recent normal range."


def build_memory_from_snapshots(
    item_id: int,
    snapshots: list[PriceSnapshot],
    current_price: float | None,
) -> dict:
    if not snapshots:
        return empty_market_memory(
            item_id=item_id,
            current_price=current_price,
        )

    now = _now_utc()
    cutoff_7 = now - timedelta(days=7)

    cleaned_snapshots = []

    for snapshot in snapshots:
        created_at = _normalise_datetime(snapshot.created_at)

        if not created_at:
            continue

        cleaned_snapshots.append(
            {
                "created_at": created_at,
                "price": _safe_float(snapshot.current_price),
                "volume": _safe_int(snapshot.volume),
                "listing_count": _safe_int(snapshot.listing_count),
            }
        )

    if not cleaned_snapshots:
        return empty_market_memory(
            item_id=item_id,
            current_price=current_price,
        )

    cleaned_snapshots.sort(
        key=lambda snapshot: snapshot["created_at"],
        reverse=True,
    )

    latest_price = _safe_float(current_price, cleaned_snapshots[0]["price"])

    snapshots_30 = cleaned_snapshots
    snapshots_7 = [
        snapshot
        for snapshot in cleaned_snapshots
        if snapshot["created_at"] >= cutoff_7
    ]

    prices_30 = [
        snapshot["price"]
        for snapshot in snapshots_30
        if snapshot["price"] > 0
    ]

    prices_7 = [
        snapshot["price"]
        for snapshot in snapshots_7
        if snapshot["price"] > 0
    ]

    volumes_30 = [
        snapshot["volume"]
        for snapshot in snapshots_30
        if snapshot["volume"] >= 0
    ]

    volumes_7 = [
        snapshot["volume"]
        for snapshot in snapshots_7
        if snapshot["volume"] >= 0
    ]

    listings_30 = [
        snapshot["listing_count"]
        for snapshot in snapshots_30
        if snapshot["listing_count"] >= 0
    ]

    listings_7 = [
        snapshot["listing_count"]
        for snapshot in snapshots_7
        if snapshot["listing_count"] >= 0
    ]

    sample_count = len(prices_30)

    if sample_count == 0:
        return empty_market_memory(
            item_id=item_id,
            current_price=current_price,
        )

    average_30 = round(mean(prices_30), 2)
    average_7 = round(mean(prices_7), 2) if prices_7 else average_30

    lowest_30 = round(min(prices_30), 2)
    highest_30 = round(max(prices_30), 2)

    volatility_score = 0.0

    if sample_count >= 2 and average_30 > 0:
        volatility_score = round(min((pstdev(prices_30) / average_30) * 100, 100), 1)

    current_vs_7 = _percent_difference(latest_price, average_7)
    current_vs_30 = _percent_difference(latest_price, average_30)
    position = _price_position(latest_price, lowest_30, highest_30)

    price_state = classify_price_state(
        sample_count=sample_count,
        current_vs_7=current_vs_7,
        current_vs_30=current_vs_30,
        price_position=position,
        volatility_score=volatility_score,
    )

    memory_score = calculate_memory_score(
        price_state=price_state,
        sample_count=sample_count,
        volatility_score=volatility_score,
        current_vs_30=current_vs_30,
        price_position=position,
    )

    return {
        "item_id": item_id,
        "sample_count": sample_count,
        "latest_price": round(latest_price, 2),
        "average_7_day_price": average_7,
        "average_30_day_price": average_30,
        "lowest_30_day_price": lowest_30,
        "highest_30_day_price": highest_30,
        "average_7_day_volume": round(mean(volumes_7), 2) if volumes_7 else None,
        "average_30_day_volume": round(mean(volumes_30), 2) if volumes_30 else None,
        "average_7_day_listing_count": round(mean(listings_7), 2) if listings_7 else None,
        "average_30_day_listing_count": round(mean(listings_30), 2) if listings_30 else None,
        "current_vs_7_day_average_percent": current_vs_7,
        "current_vs_30_day_average_percent": current_vs_30,
        "price_position_30_day_percent": position,
        "volatility_score": volatility_score,
        "price_state": price_state,
        "memory_score": memory_score,
        "memory_confidence": get_memory_confidence(sample_count),
        "memory_note": build_memory_note(
            price_state=price_state,
            sample_count=sample_count,
            current_vs_30=current_vs_30,
            volatility_score=volatility_score,
        ),
    }


async def build_market_memory_map(
    db: AsyncSession,
    connected_realm_id: int,
    items,
    days: int = 30,
) -> dict[int, dict]:
    item_ids = []
    current_prices = {}

    for item in items:
        item_id = _get_value(item, "item_id")

        if item_id is None:
            continue

        item_id = int(item_id)

        item_ids.append(item_id)
        current_prices[item_id] = _safe_float(_get_value(item, "current_price"))

    unique_item_ids = sorted(set(item_ids))

    if not unique_item_ids:
        return {}

    cutoff = _now_utc() - timedelta(days=days)

    result = await db.execute(
        select(PriceSnapshot)
        .where(
            PriceSnapshot.realm_id == connected_realm_id,
            PriceSnapshot.item_id.in_(unique_item_ids),
            PriceSnapshot.created_at >= cutoff,
        )
        .order_by(
            PriceSnapshot.item_id.asc(),
            PriceSnapshot.created_at.desc(),
        )
    )

    snapshots = result.scalars().all()

    grouped_snapshots: dict[int, list[PriceSnapshot]] = defaultdict(list)

    for snapshot in snapshots:
        grouped_snapshots[snapshot.item_id].append(snapshot)

    memory_map = {}

    for item_id in unique_item_ids:
        memory_map[item_id] = build_memory_from_snapshots(
            item_id=item_id,
            snapshots=grouped_snapshots.get(item_id, []),
            current_price=current_prices.get(item_id),
        )

    return memory_map
