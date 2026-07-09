from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import TradeEntry

router = APIRouter(
    prefix="/api",
    tags=["Performance Feedback"],
)


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
    roi_percent: float,
    win_rate_percent: float,
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


def build_recommendation(
    label: str,
    name: str,
    group_type: str,
    sold_count: int,
    roi_percent: float,
    win_rate_percent: float,
) -> str:
    if label == "Learning":
        return f"Need more sold trades before changing behaviour for this {group_type}."

    if label == "Boost":
        return f"{name} is performing strongly. GoldSmith should prioritise similar opportunities."

    if label == "Positive":
        return f"{name} is profitable so far. Keep taking clean setups."

    if label == "Penalty":
        return f"{name} is underperforming. GoldSmith should reduce confidence for this pattern."

    if label == "Caution":
        return f"{name} has weak results. Use smaller quantities or stricter entry prices."

    return f"{name} is close to neutral with {sold_count} sold trades, {roi_percent}% ROI and {win_rate_percent}% win rate."


def build_group_rows(
    trades: list[TradeEntry],
    group_type: str,
    field_name: str,
) -> list[dict]:
    grouped = defaultdict(list)

    for trade in trades:
        value = getattr(trade, field_name) or "Unknown"
        grouped[value].append(trade)

    rows = []

    for name, group in grouped.items():
        sold_group = [trade for trade in group if trade.status == "sold"]

        if not sold_group:
            continue

        total_cost = round(sum(trade.total_buy_cost for trade in sold_group), 2)
        realized_profit = round(sum(trade.realized_profit for trade in sold_group), 2)
        wins = [trade for trade in sold_group if trade.realized_profit > 0]
        losses = [trade for trade in sold_group if trade.realized_profit <= 0]

        roi_percent = round(safe_divide(realized_profit, total_cost) * 100, 2)
        win_rate_percent = round(safe_divide(len(wins), len(sold_group)) * 100, 2)
        avg_profit_per_trade = round(safe_divide(realized_profit, len(sold_group)), 2)

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

        label = get_feedback_label(
            sold_count=len(sold_group),
            roi_percent=roi_percent,
            win_rate_percent=win_rate_percent,
            score_adjustment=score_adjustment,
        )

        rows.append(
            {
                "group_type": group_type,
                "name": name,
                "trade_count": len(group),
                "sold_count": len(sold_group),
                "win_count": len(wins),
                "loss_count": len(losses),
                "total_cost": total_cost,
                "realized_profit": realized_profit,
                "roi_percent": roi_percent,
                "win_rate_percent": win_rate_percent,
                "avg_profit_per_trade": avg_profit_per_trade,
                "avg_hold_hours": avg_hold_hours,
                "feedback_label": label,
                "score_adjustment": score_adjustment,
                "recommendation": build_recommendation(
                    label=label,
                    name=name,
                    group_type=group_type,
                    sold_count=len(sold_group),
                    roi_percent=roi_percent,
                    win_rate_percent=win_rate_percent,
                ),
            }
        )

    rows.sort(
        key=lambda row: (
            row["feedback_label"] not in ["Boost", "Positive"],
            -row["score_adjustment"],
            -row["realized_profit"],
            -row["roi_percent"],
            -row["sold_count"],
        )
    )

    return rows


def build_summary(trades: list[TradeEntry]) -> dict:
    sold_trades = [trade for trade in trades if trade.status == "sold"]
    open_trades = [trade for trade in trades if trade.status == "open"]

    total_cost = round(sum(trade.total_buy_cost for trade in sold_trades), 2)
    realized_profit = round(sum(trade.realized_profit for trade in sold_trades), 2)
    wins = [trade for trade in sold_trades if trade.realized_profit > 0]

    hold_hours = [
        calculate_hold_hours(trade)
        for trade in sold_trades
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

    sold_count = len(sold_trades)
    roi_percent = round(safe_divide(realized_profit, total_cost) * 100, 2)
    win_rate_percent = round(safe_divide(len(wins), sold_count) * 100, 2)

    if sold_count >= 20:
        readiness = "High"
        readiness_note = "Enough sold trades to start strongly weighting future decisions."
    elif sold_count >= 8:
        readiness = "Medium"
        readiness_note = "Feedback is useful, but GoldSmith should still be cautious."
    elif sold_count >= 3:
        readiness = "Early"
        readiness_note = "Early signal detected. More trades will improve confidence."
    else:
        readiness = "Learning"
        readiness_note = "Not enough sold trades yet. Keep using Buy Queue and Profit Tracker."

    return {
        "total_trade_count": len(trades),
        "open_trade_count": len(open_trades),
        "sold_trade_count": sold_count,
        "total_sold_cost": total_cost,
        "realized_profit": realized_profit,
        "roi_percent": roi_percent,
        "win_rate_percent": win_rate_percent,
        "avg_hold_hours": avg_hold_hours,
        "feedback_readiness": readiness,
        "readiness_note": readiness_note,
    }


def build_insights(
    category_rows: list[dict],
    signal_rows: list[dict],
    decision_rows: list[dict],
    memory_rows: list[dict],
) -> list[dict]:
    all_rows = category_rows + signal_rows + decision_rows + memory_rows

    boost_rows = [
        row
        for row in all_rows
        if row["feedback_label"] in ["Boost", "Positive"]
    ]

    penalty_rows = [
        row
        for row in all_rows
        if row["feedback_label"] in ["Penalty", "Caution"]
    ]

    boost_rows.sort(
        key=lambda row: (
            -row["score_adjustment"],
            -row["realized_profit"],
            -row["roi_percent"],
        )
    )

    penalty_rows.sort(
        key=lambda row: (
            row["score_adjustment"],
            row["realized_profit"],
            row["roi_percent"],
        )
    )

    insights = []

    for row in boost_rows[:3]:
        insights.append(
            {
                "tone": "positive",
                "title": f"Boost {row['group_type']}: {row['name']}",
                "message": row["recommendation"],
                "score_adjustment": row["score_adjustment"],
            }
        )

    for row in penalty_rows[:3]:
        insights.append(
            {
                "tone": "negative",
                "title": f"Reduce {row['group_type']}: {row['name']}",
                "message": row["recommendation"],
                "score_adjustment": row["score_adjustment"],
            }
        )

    if not insights:
        insights.append(
            {
                "tone": "neutral",
                "title": "GoldSmith is still learning",
                "message": "Sell and record more trades to unlock reliable performance feedback.",
                "score_adjustment": 0,
            }
        )

    return insights


@router.get("/performance-feedback/summary")
async def get_performance_feedback_summary(
    connected_realm_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    try:
        query = select(TradeEntry)

        if connected_realm_id is not None:
            query = query.where(TradeEntry.realm_id == connected_realm_id)

        result = await db.execute(
            query.order_by(
                TradeEntry.created_at.desc(),
                TradeEntry.decision_score.desc(),
            )
        )

        trades = list(result.scalars().all())

        category_rows = build_group_rows(
            trades=trades,
            group_type="category",
            field_name="category",
        )

        signal_rows = build_group_rows(
            trades=trades,
            group_type="signal",
            field_name="signal",
        )

        decision_rows = build_group_rows(
            trades=trades,
            group_type="decision",
            field_name="final_decision",
        )

        memory_rows = build_group_rows(
            trades=trades,
            group_type="memory state",
            field_name="memory_price_state",
        )

        grade_rows = build_group_rows(
            trades=trades,
            group_type="grade",
            field_name="decision_grade",
        )

        all_rows = category_rows + signal_rows + decision_rows + memory_rows + grade_rows

        boost_rows = [
            row
            for row in all_rows
            if row["feedback_label"] in ["Boost", "Positive"]
        ]

        weak_rows = [
            row
            for row in all_rows
            if row["feedback_label"] in ["Penalty", "Caution"]
        ]

        boost_rows.sort(
            key=lambda row: (
                -row["score_adjustment"],
                -row["realized_profit"],
                -row["roi_percent"],
            )
        )

        weak_rows.sort(
            key=lambda row: (
                row["score_adjustment"],
                row["realized_profit"],
                row["roi_percent"],
            )
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "summary": build_summary(trades),
            "insights": build_insights(
                category_rows=category_rows,
                signal_rows=signal_rows,
                decision_rows=decision_rows,
                memory_rows=memory_rows,
            ),
            "strongest_groups": boost_rows[:10],
            "weakest_groups": weak_rows[:10],
            "by_category": category_rows,
            "by_signal": signal_rows,
            "by_decision": decision_rows,
            "by_memory_state": memory_rows,
            "by_grade": grade_rows,
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
            "summary": build_summary([]),
            "insights": [],
            "strongest_groups": [],
            "weakest_groups": [],
            "by_category": [],
            "by_signal": [],
            "by_decision": [],
            "by_memory_state": [],
            "by_grade": [],
        }
