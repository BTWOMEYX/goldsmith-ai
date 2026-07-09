from collections import defaultdict
from datetime import timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import TradeEntry


def safe_divide(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0

    return numerator / denominator


def normalise_datetime(value):
    if not value:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def calculate_hold_hours(trade: TradeEntry) -> float | None:
    created_at = normalise_datetime(trade.created_at)
    sold_at = normalise_datetime(trade.sold_at)

    if not created_at or not sold_at:
        return None

    seconds = (sold_at - created_at).total_seconds()

    if seconds < 0:
        return None

    return round(seconds / 3600, 2)


def calculate_score_adjustment(
    sold_count: int,
    roi_percent: float,
    win_rate_percent: float,
    avg_hold_hours: float | None,
) -> int:
    if sold_count < 3:
        return 0

    adjustment = 0

    if roi_percent >= 25 and win_rate_percent >= 70:
        adjustment += 12
    elif roi_percent >= 15 and win_rate_percent >= 60:
        adjustment += 8
    elif roi_percent >= 5 and win_rate_percent >= 50:
        adjustment += 4

    if roi_percent <= -20:
        adjustment -= 14
    elif roi_percent <= -10:
        adjustment -= 9
    elif roi_percent < 0:
        adjustment -= 4

    if win_rate_percent <= 30:
        adjustment -= 8
    elif win_rate_percent <= 40:
        adjustment -= 4

    if avg_hold_hours is not None:
        if avg_hold_hours <= 24 and roi_percent > 0:
            adjustment += 3
        elif avg_hold_hours >= 168 and roi_percent < 10:
            adjustment -= 4

    return max(-20, min(adjustment, 15))


def get_feedback_label(
    sold_count: int,
    score_adjustment: int,
) -> str:
    if sold_count < 3:
        return "Learning"

    if score_adjustment >= 8:
        return "Boost"

    if score_adjustment >= 3:
        return "Positive"

    if score_adjustment <= -8:
        return "Penalty"

    if score_adjustment <= -3:
        return "Caution"

    return "Neutral"


def build_rows_by_field(
    trades: list[TradeEntry],
    field_name: str,
) -> dict[str, dict]:
    grouped = defaultdict(list)

    for trade in trades:
        key = getattr(trade, field_name) or "Unknown"
        grouped[key].append(trade)

    rows: dict[str, dict] = {}

    for name, group in grouped.items():
        sold_group = [trade for trade in group if trade.status == "sold"]

        if not sold_group:
            continue

        total_cost = round(sum(trade.total_buy_cost for trade in sold_group), 2)
        realized_profit = round(sum(trade.realized_profit for trade in sold_group), 2)
        wins = [trade for trade in sold_group if trade.realized_profit > 0]

        roi_percent = round(safe_divide(realized_profit, total_cost) * 100, 2)
        win_rate_percent = round(safe_divide(len(wins), len(sold_group)) * 100, 2)

        hold_hours = [
            calculate_hold_hours(trade)
            for trade in sold_group
        ]

        hold_hours = [
            value
            for value in hold_hours
            if value is not None
        ]

        avg_hold_hours = (
            round(sum(hold_hours) / len(hold_hours), 2)
            if hold_hours
            else None
        )

        score_adjustment = calculate_score_adjustment(
            sold_count=len(sold_group),
            roi_percent=roi_percent,
            win_rate_percent=win_rate_percent,
            avg_hold_hours=avg_hold_hours,
        )

        feedback_label = get_feedback_label(
            sold_count=len(sold_group),
            score_adjustment=score_adjustment,
        )

        rows[name] = {
            "name": name,
            "sold_count": len(sold_group),
            "total_cost": total_cost,
            "realized_profit": realized_profit,
            "roi_percent": roi_percent,
            "win_rate_percent": win_rate_percent,
            "avg_hold_hours": avg_hold_hours,
            "score_adjustment": score_adjustment,
            "feedback_label": feedback_label,
        }

    return rows


async def build_feedback_adjustment_map(
    db: AsyncSession,
    connected_realm_id: int,
) -> dict:
    result = await db.execute(
        select(TradeEntry).where(
            TradeEntry.realm_id == connected_realm_id,
            TradeEntry.status == "sold",
        )
    )

    trades = list(result.scalars().all())

    return {
        "category": build_rows_by_field(trades, "category"),
        "signal": build_rows_by_field(trades, "signal"),
        "memory": build_rows_by_field(trades, "memory_price_state"),
        "decision": build_rows_by_field(trades, "final_decision"),
        "grade": build_rows_by_field(trades, "decision_grade"),
    }


def get_feedback_row(
    feedback_map: dict | None,
    group_name: str,
    value: str | None,
) -> dict | None:
    if not feedback_map:
        return None

    group = feedback_map.get(group_name, {})
    key = value or "Unknown"

    return group.get(key)


def build_source_summary(
    group_name: str,
    row: dict,
    weight: float,
) -> dict:
    contribution = row["score_adjustment"] * weight

    return {
        "group": group_name,
        "name": row["name"],
        "sold_count": row["sold_count"],
        "roi_percent": row["roi_percent"],
        "win_rate_percent": row["win_rate_percent"],
        "feedback_label": row["feedback_label"],
        "raw_adjustment": row["score_adjustment"],
        "weighted_adjustment": round(contribution, 2),
    }


def combine_performance_feedback_adjustments(
    feedback_map: dict | None,
    category: str | None,
    signal: str | None,
    memory_price_state: str | None,
) -> dict:
    if not feedback_map:
        return {
            "score_adjustment": 0,
            "feedback_label": "Learning",
            "feedback_note": "Not enough sold trade feedback yet.",
            "sources": [],
        }

    sources = []

    category_row = get_feedback_row(feedback_map, "category", category)
    signal_row = get_feedback_row(feedback_map, "signal", signal)
    memory_row = get_feedback_row(feedback_map, "memory", memory_price_state)

    if category_row and category_row["sold_count"] >= 3:
        sources.append(build_source_summary("category", category_row, 0.40))

    if signal_row and signal_row["sold_count"] >= 3:
        sources.append(build_source_summary("signal", signal_row, 0.35))

    if memory_row and memory_row["sold_count"] >= 3:
        sources.append(build_source_summary("memory", memory_row, 0.25))

    if not sources:
        return {
            "score_adjustment": 0,
            "feedback_label": "Learning",
            "feedback_note": "GoldSmith needs at least 3 sold trades in this pattern before adjusting confidence.",
            "sources": [],
        }

    weighted_total = sum(source["weighted_adjustment"] for source in sources)
    score_adjustment = round(weighted_total)

    score_adjustment = max(-12, min(score_adjustment, 10))

    if score_adjustment >= 6:
        label = "Boost"
    elif score_adjustment >= 2:
        label = "Positive"
    elif score_adjustment <= -6:
        label = "Penalty"
    elif score_adjustment <= -2:
        label = "Caution"
    else:
        label = "Neutral"

    source_text = ", ".join(
        [
            f"{source['group']} {source['name']} {source['feedback_label']} {source['raw_adjustment']:+}"
            for source in sources
        ]
    )

    return {
        "score_adjustment": score_adjustment,
        "feedback_label": label,
        "feedback_note": f"Performance feedback {score_adjustment:+}: {source_text}.",
        "sources": sources,
    }
