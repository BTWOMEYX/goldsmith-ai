from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules
from app.services.market_memory import build_market_memory_map, empty_market_memory
from app.services.performance_feedback import build_feedback_adjustment_map, combine_performance_feedback_adjustments
from app.utils.realms import get_realm_display_name
from database import get_db
from models import PriceSnapshot, TrackedItem, WatchlistItem

router = APIRouter(
    prefix="/api",
    tags=["Deal Alerts"],
)


FAST_MOVE_CATEGORIES = {
    "Crafting Materials",
    "Consumables",
    "Enchants",
    "Gems",
    "Glyphs",
}


SLOW_MARGIN_CATEGORIES = {
    "Gear / Transmog",
    "Recipes / Plans",
    "Battle Pets",
    "Rare / Collector Items",
}


def calculate_percent_change(
    current_value: float,
    previous_value: float | None,
) -> float:
    if previous_value is None or previous_value <= 0:
        return 0.0

    return round(((current_value - previous_value) / previous_value) * 100, 2)


def calculate_deal_confidence(
    item: TrackedItem,
    price_change_percent: float,
) -> float:
    confidence = 30.0

    confidence += min(item.opportunity_score / 100, 1) * 35
    confidence += min(item.volume / 100, 1) * 15
    confidence += min(item.listing_count / 40, 1) * 10

    risk_level = item.risk_level.lower()
    category = item.goldsmith_category or "Unknown / Other"

    if risk_level == "low":
        confidence += 10
    elif risk_level == "medium":
        confidence += 5
    elif risk_level == "high":
        confidence -= 15

    if category in FAST_MOVE_CATEGORIES:
        confidence += 6

    if category in SLOW_MARGIN_CATEGORIES and item.current_price >= 1000:
        confidence += 4

    if price_change_percent <= -5:
        confidence += 8

    if price_change_percent <= -15:
        confidence += 5

    return round(max(1, min(confidence, 100)), 1)


def apply_market_memory_to_confidence(
    base_confidence: float,
    market_memory: dict,
) -> float:
    adjusted_confidence = base_confidence

    price_state = market_memory.get("price_state", "Learning")
    memory_confidence = market_memory.get("memory_confidence", "Low")
    volatility_score = float(market_memory.get("volatility_score") or 0)
    sample_count = int(market_memory.get("sample_count") or 0)

    if price_state == "Deep Undervalued":
        adjusted_confidence += 14
    elif price_state == "Undervalued":
        adjusted_confidence += 9
    elif price_state == "Below Normal":
        adjusted_confidence += 4
    elif price_state == "Fair Value":
        adjusted_confidence += 0
    elif price_state == "Above Normal":
        adjusted_confidence -= 6
    elif price_state == "Overpriced":
        adjusted_confidence -= 18
    elif price_state == "Volatile":
        adjusted_confidence -= 14
    elif price_state == "Learning":
        adjusted_confidence -= 5

    if memory_confidence == "High":
        adjusted_confidence += 4
    elif memory_confidence == "Medium":
        adjusted_confidence += 2
    elif memory_confidence == "Low":
        adjusted_confidence -= 2

    if volatility_score >= 70:
        adjusted_confidence -= 10
    elif volatility_score >= 45:
        adjusted_confidence -= 5
    elif volatility_score <= 18 and sample_count >= 5:
        adjusted_confidence += 3

    return round(max(1, min(adjusted_confidence, 100)), 1)


def get_price_targets(item: TrackedItem, market_memory: dict | None = None) -> dict:
    category = item.goldsmith_category or "Unknown / Other"
    current_price = item.current_price

    memory_price_state = (
        market_memory.get("price_state")
        if market_memory
        else "Learning"
    )

    if category in FAST_MOVE_CATEGORIES:
        buy_below = current_price * 0.96
        resale_target = current_price * 1.14
    elif category in SLOW_MARGIN_CATEGORIES:
        buy_below = current_price * 0.88
        resale_target = current_price * 1.35
    else:
        buy_below = current_price * 0.93
        resale_target = current_price * 1.18

    average_30 = (
        market_memory.get("average_30_day_price")
        if market_memory
        else None
    )

    if average_30 and average_30 > 0:
        if memory_price_state in ["Deep Undervalued", "Undervalued"]:
            resale_target = max(resale_target, average_30 * 0.96)
        elif memory_price_state == "Below Normal":
            resale_target = max(resale_target, average_30 * 0.92)
        elif memory_price_state in ["Above Normal", "Overpriced"]:
            buy_below = min(buy_below, average_30 * 0.82)
            resale_target = min(resale_target, average_30 * 1.05)

    estimated_profit = resale_target - buy_below
    estimated_margin_percent = (
        (estimated_profit / buy_below) * 100 if buy_below > 0 else 0
    )

    return {
        "suggested_buy_below": round(buy_below, 2),
        "target_resale_price": round(resale_target, 2),
        "estimated_profit_before_costs": round(estimated_profit, 2),
        "estimated_margin_percent": round(estimated_margin_percent, 2),
    }


def calculate_liquidity_score(item: TrackedItem) -> float:
    category = item.goldsmith_category or "Unknown / Other"
    risk = item.risk_level.lower()

    score = 0.0

    score += min(item.volume / 100, 1) * 45
    score += min(item.listing_count / 40, 1) * 25

    if category in FAST_MOVE_CATEGORIES:
        score += 20
    elif category in SLOW_MARGIN_CATEGORIES:
        score += 5
    else:
        score += 10

    if risk == "low":
        score += 10
    elif risk == "medium":
        score += 5
    elif risk == "high":
        score -= 15

    if item.current_price >= 100000:
        score -= 8
    elif item.current_price >= 50000:
        score -= 5

    return round(max(1, min(score, 100)), 1)


def calculate_sale_speed(
    item: TrackedItem,
    liquidity_score: float,
) -> str:
    category = item.goldsmith_category or "Unknown / Other"
    risk = item.risk_level.lower()

    if risk == "high":
        return "Slow"

    if category in FAST_MOVE_CATEGORIES:
        if liquidity_score >= 70 and item.volume >= 35:
            return "Fast"

        if liquidity_score >= 45 and item.volume >= 15:
            return "Medium"

        return "Slow"

    if category in SLOW_MARGIN_CATEGORIES:
        if liquidity_score >= 75 and item.volume >= 25:
            return "Medium"

        return "Slow"

    if liquidity_score >= 70:
        return "Fast"

    if liquidity_score >= 45:
        return "Medium"

    return "Slow"


def build_deal_signal(
    item: TrackedItem,
    price_change_percent: float,
    confidence: float,
    market_memory: dict,
) -> dict:
    category = item.goldsmith_category or "Unknown / Other"
    risk = item.risk_level.lower()
    memory_price_state = market_memory.get("price_state", "Learning")

    if memory_price_state == "Overpriced":
        return {
            "signal": "AVOID",
            "label": "Avoid",
            "priority": 7,
            "tone": "negative",
            "action": "Market memory says this is overpriced. Do not buy.",
        }

    if memory_price_state == "Volatile" and risk != "low":
        return {
            "signal": "AVOID",
            "label": "Avoid",
            "priority": 7,
            "tone": "negative",
            "action": "Market memory says this is volatile and risk is not low.",
        }

    if (
        memory_price_state == "Deep Undervalued"
        and confidence >= 74
        and risk in ["low", "medium"]
        and item.volume >= 12
    ):
        return {
            "signal": "MEMORY_BUY",
            "label": "Memory Buy",
            "priority": 1,
            "tone": "strong",
            "action": "Historical pricing shows a strong undervalued opportunity.",
        }

    if (
        item.opportunity_score >= 78
        and confidence >= 75
        and risk in ["low", "medium"]
        and item.volume >= 20
        and item.listing_count >= 5
    ):
        return {
            "signal": "AUTO_WATCH",
            "label": "Auto Watch",
            "priority": 2,
            "tone": "strong",
            "action": "High-confidence opportunity. Auto-watch candidate.",
        }

    if (
        category in FAST_MOVE_CATEGORIES
        and item.opportunity_score >= 62
        and confidence >= 68
        and item.volume >= 25
        and risk in ["low", "medium"]
    ):
        return {
            "signal": "FAST_MOVER",
            "label": "Fast Mover",
            "priority": 3,
            "tone": "positive",
            "action": "Fast-moving category with useful market depth.",
        }

    if (
        price_change_percent <= -10
        and item.opportunity_score >= 55
        and confidence >= 62
    ):
        return {
            "signal": "PRICE_DROP",
            "label": "Price Drop",
            "priority": 4,
            "tone": "positive",
            "action": "Price has dropped sharply. Check for a buying window.",
        }

    if (
        category in SLOW_MARGIN_CATEGORIES
        and item.current_price >= 1000
        and item.opportunity_score >= 65
        and confidence >= 60
    ):
        return {
            "signal": "HIGH_MARGIN",
            "label": "High Margin",
            "priority": 5,
            "tone": "positive",
            "action": "Slower-moving item with higher margin potential.",
        }

    if item.opportunity_score >= 55 and risk in ["low", "medium"]:
        return {
            "signal": "WATCH_CANDIDATE",
            "label": "Watch Candidate",
            "priority": 6,
            "tone": "neutral",
            "action": "Worth watching, but not urgent enough for auto-watch.",
        }

    if risk == "high":
        return {
            "signal": "AVOID",
            "label": "Avoid",
            "priority": 8,
            "tone": "negative",
            "action": "Risk is high. Do not buy unless you verify demand.",
        }

    return {
        "signal": "HOLD",
        "label": "Hold",
        "priority": 7,
        "tone": "neutral",
        "action": "No urgent action yet.",
    }


def calculate_suggested_quantity(
    item: TrackedItem,
    signal: str,
    confidence: float,
    sale_speed: str,
    suggested_buy_below: float,
    market_memory: dict,
) -> int:
    category = item.goldsmith_category or "Unknown / Other"
    risk = item.risk_level.lower()
    price_state = market_memory.get("price_state", "Learning")
    volatility_score = float(market_memory.get("volatility_score") or 0)
    sample_count = int(market_memory.get("sample_count") or 0)

    if signal == "AVOID":
        return 0

    if risk == "high":
        return 0

    if price_state == "Overpriced":
        return 0

    if price_state == "Volatile" and volatility_score >= 65:
        return 1 if confidence >= 80 and risk == "low" else 0

    if confidence < 58:
        return 0

    if sale_speed == "Slow" and category not in SLOW_MARGIN_CATEGORIES:
        quantity = 1
    elif category in SLOW_MARGIN_CATEGORIES:
        if confidence >= 84 and risk == "low":
            quantity = 2
        else:
            quantity = 1
    elif category in FAST_MOVE_CATEGORIES:
        if confidence >= 88:
            quantity = max(1, int(item.volume * 0.12))
        elif confidence >= 78:
            quantity = max(1, int(item.volume * 0.07))
        elif confidence >= 68:
            quantity = max(1, int(item.volume * 0.04))
        else:
            quantity = 1

        quantity = min(quantity, 30)
    else:
        if confidence >= 82:
            quantity = max(1, int(item.volume * 0.05))
        elif confidence >= 68:
            quantity = max(1, int(item.volume * 0.025))
        else:
            quantity = 1

        quantity = min(quantity, 10)

    if price_state == "Deep Undervalued" and sample_count >= 5 and sale_speed in ["Fast", "Medium"]:
        quantity = int(quantity * 1.5) + 1
    elif price_state == "Undervalued" and sample_count >= 5:
        quantity = int(quantity * 1.25) + 1
    elif price_state == "Below Normal":
        quantity = max(1, quantity)
    elif price_state == "Learning":
        quantity = min(quantity, 2)
    elif price_state == "Above Normal":
        quantity = min(quantity, 1)

    if volatility_score >= 45:
        quantity = max(0, int(quantity * 0.5))

    if suggested_buy_below >= 50000:
        quantity = min(quantity, 1)
    elif suggested_buy_below >= 20000:
        quantity = min(quantity, 2)
    elif suggested_buy_below >= 10000:
        quantity = min(quantity, 3)
    elif suggested_buy_below >= 5000:
        quantity = min(quantity, 5)

    return max(0, quantity)


def calculate_capital_risk(
    item: TrackedItem,
    suggested_quantity: int,
    suggested_buy_below: float,
    sale_speed: str,
    confidence: float,
    market_memory: dict,
) -> dict:
    max_gold_exposure = round(suggested_quantity * suggested_buy_below, 2)
    risk = item.risk_level.lower()
    price_state = market_memory.get("price_state", "Learning")
    volatility_score = float(market_memory.get("volatility_score") or 0)

    if suggested_quantity <= 0:
        return {
            "max_gold_exposure": 0,
            "capital_risk_label": "Avoid",
            "capital_action": "Do not buy",
            "buy_strategy": "Ignore unless manually verified",
            "capital_note": "GoldSmith rejected this because confidence, risk, memory, or liquidity is not strong enough.",
        }

    if price_state == "Overpriced":
        return {
            "max_gold_exposure": 0,
            "capital_risk_label": "Avoid",
            "capital_action": "Do not buy",
            "buy_strategy": "Overpriced against memory",
            "capital_note": "Market Memory says the current price is above normal. Wait for a better entry.",
        }

    if volatility_score >= 65:
        return {
            "max_gold_exposure": max_gold_exposure,
            "capital_risk_label": "High",
            "capital_action": "Buy one only",
            "buy_strategy": "Volatility-controlled sniper",
            "capital_note": "Market Memory shows unstable pricing. Keep exposure tiny.",
        }

    if (
        price_state in ["Deep Undervalued", "Undervalued"]
        and risk == "low"
        and sale_speed in ["Fast", "Medium"]
        and confidence >= 75
        and max_gold_exposure <= 100000
    ):
        return {
            "max_gold_exposure": max_gold_exposure,
            "capital_risk_label": "Low",
            "capital_action": "Buy if below target",
            "buy_strategy": "Memory-backed position",
            "capital_note": "Market Memory supports the buy. Position size is allowed within exposure limits.",
        }

    if risk == "low" and sale_speed == "Fast" and max_gold_exposure <= 25000:
        return {
            "max_gold_exposure": max_gold_exposure,
            "capital_risk_label": "Low",
            "capital_action": "Buy if below target",
            "buy_strategy": "Small stack flip",
            "capital_note": "Fast-moving item with controlled exposure. Safe to buy in small batches.",
        }

    if risk in ["low", "medium"] and max_gold_exposure <= 75000 and confidence >= 68:
        return {
            "max_gold_exposure": max_gold_exposure,
            "capital_risk_label": "Medium",
            "capital_action": "Buy carefully",
            "buy_strategy": "Controlled position",
            "capital_note": "Opportunity is valid, but do not overbuy. Stay under the max spend.",
        }

    if sale_speed == "Slow":
        return {
            "max_gold_exposure": max_gold_exposure,
            "capital_risk_label": "High",
            "capital_action": "Buy one only",
            "buy_strategy": "Single-unit sniper",
            "capital_note": "Potential margin exists, but sale speed is slow. Only buy one if the price is excellent.",
        }

    return {
        "max_gold_exposure": max_gold_exposure,
        "capital_risk_label": "High",
        "capital_action": "Watch only",
        "buy_strategy": "Wait for cleaner pricing",
        "capital_note": "Exposure is too high for the current confidence profile.",
    }


def build_decision_fusion(
    item: TrackedItem,
    signal_data: dict,
    confidence: float,
    sale_speed: str,
    liquidity_score: float,
    suggested_quantity: int,
    capital_guardrails: dict,
    market_memory: dict,
) -> dict:
    decision_score = 0.0

    decision_score += min(item.opportunity_score, 100) * 0.25
    decision_score += min(confidence, 100) * 0.30
    decision_score += min(liquidity_score, 100) * 0.15
    decision_score += min(float(market_memory.get("memory_score") or 0), 100) * 0.25

    risk = item.risk_level.lower()
    price_state = market_memory.get("price_state", "Learning")
    capital_risk = capital_guardrails.get("capital_risk_label", "Medium")
    volatility_score = float(market_memory.get("volatility_score") or 0)

    if risk == "low":
        decision_score += 6
    elif risk == "medium":
        decision_score += 1
    elif risk == "high":
        decision_score -= 18

    if sale_speed == "Fast":
        decision_score += 6
    elif sale_speed == "Medium":
        decision_score += 2
    elif sale_speed == "Slow":
        decision_score -= 6

    if price_state == "Deep Undervalued":
        decision_score += 10
    elif price_state == "Undervalued":
        decision_score += 6
    elif price_state == "Below Normal":
        decision_score += 2
    elif price_state == "Above Normal":
        decision_score -= 6
    elif price_state == "Overpriced":
        decision_score -= 25
    elif price_state == "Volatile":
        decision_score -= 12
    elif price_state == "Learning":
        decision_score -= 3

    if capital_risk == "Low":
        decision_score += 5
    elif capital_risk == "Medium":
        decision_score += 0
    elif capital_risk == "High":
        decision_score -= 10
    elif capital_risk == "Avoid":
        decision_score -= 30

    if suggested_quantity <= 0:
        decision_score -= 25

    if volatility_score >= 65:
        decision_score -= 10

    decision_score = round(max(1, min(decision_score, 100)), 1)

    if suggested_quantity <= 0 or capital_risk == "Avoid" or signal_data["signal"] == "AVOID":
        final_decision = "Avoid"
        decision_grade = "D"
        buy_pressure = "None"
    elif decision_score >= 88:
        final_decision = "Strong Buy"
        decision_grade = "S"
        buy_pressure = "Very High"
    elif decision_score >= 78:
        final_decision = "Buy"
        decision_grade = "A"
        buy_pressure = "High"
    elif decision_score >= 66:
        final_decision = "Small Buy"
        decision_grade = "B"
        buy_pressure = "Medium"
    elif decision_score >= 54:
        final_decision = "Watch"
        decision_grade = "C"
        buy_pressure = "Low"
    else:
        final_decision = "Avoid"
        decision_grade = "D"
        buy_pressure = "None"

    if suggested_quantity <= 0:
        position_size_label = "No position"
    elif suggested_quantity == 1:
        position_size_label = "Single item"
    elif suggested_quantity <= 3:
        position_size_label = "Small position"
    elif suggested_quantity <= 10:
        position_size_label = "Medium position"
    else:
        position_size_label = "Large position"

    if final_decision in ["Strong Buy", "Buy"]:
        decision_note = (
            f"{final_decision}: {price_state}, {sale_speed.lower()} sale speed, "
            f"{risk} risk, memory score {market_memory.get('memory_score')}, "
            f"confidence {confidence}%."
        )
    elif final_decision == "Small Buy":
        decision_note = (
            f"Small Buy: opportunity is valid, but position is capped due to "
            f"{capital_risk.lower()} capital risk, sale speed, or memory confidence."
        )
    elif final_decision == "Watch":
        decision_note = (
            "Watch: not clean enough for a confident buy yet. Wait for better price, "
            "more history, or stronger volume."
        )
    else:
        decision_note = (
            f"Avoid: {price_state}, {capital_risk.lower()} capital risk, "
            f"{risk} item risk, or insufficient confidence."
        )

    return {
        "final_decision": final_decision,
        "decision_grade": decision_grade,
        "decision_score": decision_score,
        "buy_pressure": buy_pressure,
        "position_size_label": position_size_label,
        "decision_note": decision_note,
    }


def build_deal_reason(
    item: TrackedItem,
    signal_label: str,
    confidence: float,
    price_change_percent: float,
    sale_speed: str,
    suggested_quantity: int,
    max_gold_exposure: float,
    final_decision: str,
    decision_score: float,
    memory_price_state: str,
) -> str:
    category = item.goldsmith_category or "Unknown / Other"

    return (
        f"{final_decision}: {signal_label}, {category}, score {item.opportunity_score}/100, "
        f"{item.risk_level.lower()} risk, {item.volume} quantity across "
        f"{item.listing_count} listings, confidence {confidence}%, "
        f"memory {memory_price_state}, sale speed {sale_speed}, "
        f"suggested quantity {suggested_quantity}, max exposure {round(max_gold_exposure)}g, "
        f"decision score {decision_score}, price movement {price_change_percent}%."
    )


async def load_watched_keys(db: AsyncSession) -> set[tuple[int, int]]:
    result = await db.execute(select(WatchlistItem))

    watchlist_items = result.scalars().all()

    return {
        (item.realm_id, item.item_id)
        for item in watchlist_items
    }


async def load_latest_snapshot_map(
    connected_realm_id: int,
    db: AsyncSession,
) -> dict[int, list[PriceSnapshot]]:
    result = await db.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.realm_id == connected_realm_id)
        .order_by(PriceSnapshot.created_at.desc())
        .limit(2000)
    )

    snapshots = result.scalars().all()

    grouped_snapshots: dict[int, list[PriceSnapshot]] = {}

    for snapshot in snapshots:
        if snapshot.item_id not in grouped_snapshots:
            grouped_snapshots[snapshot.item_id] = []

        grouped_snapshots[snapshot.item_id].append(snapshot)

    return grouped_snapshots


def serialize_deal_alert(
    item: TrackedItem,
    watched_keys: set[tuple[int, int]],
    snapshot_map: dict[int, list[PriceSnapshot]],
    market_memory_map: dict[int, dict] | None = None,
    performance_feedback_map: dict | None = None,
) -> dict:
    item_snapshots = snapshot_map.get(item.item_id, [])

    latest_snapshot = item_snapshots[0] if len(item_snapshots) > 0 else None
    previous_snapshot = item_snapshots[1] if len(item_snapshots) > 1 else None

    previous_price = previous_snapshot.current_price if previous_snapshot else None
    current_price = latest_snapshot.current_price if latest_snapshot else item.current_price

    price_change = 0.0

    if previous_snapshot:
        price_change = round(current_price - previous_snapshot.current_price, 2)

    price_change_percent = calculate_percent_change(
        current_value=current_price,
        previous_value=previous_price,
    )

    market_memory = (
        market_memory_map.get(item.item_id)
        if market_memory_map and market_memory_map.get(item.item_id)
        else empty_market_memory(
            item_id=item.item_id,
            current_price=item.current_price,
        )
    )

    base_confidence = calculate_deal_confidence(
        item=item,
        price_change_percent=price_change_percent,
    )

    pre_feedback_confidence = apply_market_memory_to_confidence(
        base_confidence=base_confidence,
        market_memory=market_memory,
    )

    initial_signal_data = build_deal_signal(
        item=item,
        price_change_percent=price_change_percent,
        confidence=pre_feedback_confidence,
        market_memory=market_memory,
    )

    performance_feedback = combine_performance_feedback_adjustments(
        feedback_map=performance_feedback_map,
        category=item.goldsmith_category,
        signal=initial_signal_data["signal"],
        memory_price_state=market_memory["price_state"],
    )

    memory_adjusted_confidence = round(
        max(
            1,
            min(
                pre_feedback_confidence + performance_feedback["score_adjustment"],
                100,
            ),
        ),
        1,
    )

    signal_data = build_deal_signal(
        item=item,
        price_change_percent=price_change_percent,
        confidence=memory_adjusted_confidence,
        market_memory=market_memory,
    )

    price_targets = get_price_targets(
        item=item,
        market_memory=market_memory,
    )

    liquidity_score = calculate_liquidity_score(item)

    sale_speed = calculate_sale_speed(
        item=item,
        liquidity_score=liquidity_score,
    )

    suggested_quantity = calculate_suggested_quantity(
        item=item,
        signal=signal_data["signal"],
        confidence=memory_adjusted_confidence,
        sale_speed=sale_speed,
        suggested_buy_below=price_targets["suggested_buy_below"],
        market_memory=market_memory,
    )

    capital_guardrails = calculate_capital_risk(
        item=item,
        suggested_quantity=suggested_quantity,
        suggested_buy_below=price_targets["suggested_buy_below"],
        sale_speed=sale_speed,
        confidence=memory_adjusted_confidence,
        market_memory=market_memory,
    )

    decision_fusion = build_decision_fusion(
        item=item,
        signal_data=signal_data,
        confidence=memory_adjusted_confidence,
        sale_speed=sale_speed,
        liquidity_score=liquidity_score,
        suggested_quantity=suggested_quantity,
        capital_guardrails=capital_guardrails,
        market_memory=market_memory,
    )

    is_watched = (item.realm_id, item.item_id) in watched_keys

    return {
        "item_id": item.item_id,
        "realm_id": item.realm_id,
        "name": item.name,
        "current_price": item.current_price,
        "previous_price": previous_price,
        "price_change": price_change,
        "price_change_percent": price_change_percent,
        "volume": item.volume,
        "listing_count": item.listing_count,
        "opportunity_score": item.opportunity_score,
        "risk_level": item.risk_level,
        "reason": item.reason,
        "icon_url": item.icon_url,
        "quality": item.quality,
        "item_class": item.item_class,
        "item_subclass": item.item_subclass,
        "goldsmith_category": item.goldsmith_category,
        "profit_margin": item.profit_margin,
        "signal": signal_data["signal"],
        "signal_label": signal_data["label"],
        "signal_priority": signal_data["priority"],
        "signal_tone": signal_data["tone"],
        "signal_action": signal_data["action"],
        "signal_confidence": memory_adjusted_confidence,
        "base_signal_confidence": base_confidence,
        "pre_feedback_confidence": pre_feedback_confidence,
        "memory_adjusted_confidence": memory_adjusted_confidence,
        "feedback_adjustment": performance_feedback["score_adjustment"],
        "feedback_label": performance_feedback["feedback_label"],
        "feedback_note": performance_feedback["feedback_note"],
        "performance_feedback": performance_feedback,
        "is_watched": is_watched,
        "liquidity_score": liquidity_score,
        "sale_speed": sale_speed,
        "suggested_buy_quantity": suggested_quantity,
        "market_memory": market_memory,
        "memory_price_state": market_memory["price_state"],
        "memory_score": market_memory["memory_score"],
        "memory_confidence": market_memory["memory_confidence"],
        "memory_sample_count": market_memory["sample_count"],
        "memory_note": market_memory["memory_note"],
        "memory_volatility_score": market_memory["volatility_score"],
        "memory_discount_percent": market_memory["current_vs_30_day_average_percent"],
        "memory_price_position_percent": market_memory["price_position_30_day_percent"],
        "memory_average_7_day_price": market_memory["average_7_day_price"],
        "memory_average_30_day_price": market_memory["average_30_day_price"],
        **price_targets,
        **capital_guardrails,
        **decision_fusion,
    } | {
        "signal_reason": build_deal_reason(
            item=item,
            signal_label=signal_data["label"],
            confidence=memory_adjusted_confidence,
            price_change_percent=price_change_percent,
            sale_speed=sale_speed,
            suggested_quantity=suggested_quantity,
            max_gold_exposure=capital_guardrails["max_gold_exposure"],
            final_decision=decision_fusion["final_decision"],
            decision_score=decision_fusion["decision_score"],
            memory_price_state=market_memory["price_state"],
        ),
    }


def build_deal_summary(items: list[dict]) -> dict:
    return {
        "strong_buy_count": len(
            [item for item in items if item.get("final_decision") == "Strong Buy"]
        ),
        "buy_count": len(
            [item for item in items if item.get("final_decision") == "Buy"]
        ),
        "small_buy_count": len(
            [item for item in items if item.get("final_decision") == "Small Buy"]
        ),
        "watch_decision_count": len(
            [item for item in items if item.get("final_decision") == "Watch"]
        ),
        "avoid_decision_count": len(
            [item for item in items if item.get("final_decision") == "Avoid"]
        ),
        "auto_watch_count": len(
            [item for item in items if item["signal"] == "AUTO_WATCH"]
        ),
        "memory_buy_count": len(
            [item for item in items if item["signal"] == "MEMORY_BUY"]
        ),
        "fast_mover_count": len(
            [item for item in items if item["signal"] == "FAST_MOVER"]
        ),
        "price_drop_count": len(
            [item for item in items if item["signal"] == "PRICE_DROP"]
        ),
        "high_margin_count": len(
            [item for item in items if item["signal"] == "HIGH_MARGIN"]
        ),
        "watch_candidate_count": len(
            [item for item in items if item["signal"] == "WATCH_CANDIDATE"]
        ),
        "hold_count": len(
            [item for item in items if item["signal"] == "HOLD"]
        ),
        "avoid_count": len(
            [item for item in items if item["signal"] == "AVOID"]
        ),
        "low_capital_risk_count": len(
            [item for item in items if item.get("capital_risk_label") == "Low"]
        ),
        "medium_capital_risk_count": len(
            [item for item in items if item.get("capital_risk_label") == "Medium"]
        ),
        "high_capital_risk_count": len(
            [item for item in items if item.get("capital_risk_label") == "High"]
        ),
        "avoid_capital_count": len(
            [item for item in items if item.get("capital_risk_label") == "Avoid"]
        ),
        "feedback_boost_count": len(
            [item for item in items if item.get("feedback_label") in ["Boost", "Positive"]]
        ),
        "feedback_caution_count": len(
            [item for item in items if item.get("feedback_label") in ["Penalty", "Caution"]]
        ),
    }


def should_auto_watch(alert: dict) -> bool:
    if alert["is_watched"]:
        return False

    if alert.get("suggested_buy_quantity", 0) <= 0:
        return False

    if alert.get("capital_risk_label") in ["High", "Avoid"]:
        return False

    if alert.get("final_decision") not in ["Strong Buy", "Buy", "Small Buy"]:
        return False

    if alert.get("decision_score", 0) < 68:
        return False

    if alert.get("memory_price_state") in ["Overpriced", "Volatile"]:
        return False

    if alert.get("feedback_label") == "Penalty" and alert.get("feedback_adjustment", 0) <= -6:
        return False

    if alert["signal"] == "MEMORY_BUY" and alert["signal_confidence"] >= 72:
        return True

    if alert["signal"] == "AUTO_WATCH" and alert["signal_confidence"] >= 72:
        return True

    if (
        alert["signal"] == "FAST_MOVER"
        and alert["signal_confidence"] >= 72
        and alert["risk_level"].lower() in ["low", "medium"]
    ):
        return True

    if (
        alert["signal"] == "PRICE_DROP"
        and alert["signal_confidence"] >= 76
        and alert["risk_level"].lower() in ["low", "medium"]
    ):
        return True

    if (
        alert["signal"] == "HIGH_MARGIN"
        and alert["signal_confidence"] >= 80
        and alert["current_price"] >= 1000
        and alert.get("suggested_buy_quantity", 0) <= 2
    ):
        return True

    return False


@router.get("/deals/alerts")
async def get_deal_alerts(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        tracked_result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == connected_realm_id)
            .order_by(
                TrackedItem.opportunity_score.desc(),
                TrackedItem.volume.desc(),
                TrackedItem.current_price.desc(),
            )
        )

        tracked_items = tracked_result.scalars().all()

        ignore_rules = await get_active_ignore_rules(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        tracked_items, ignored_count = filter_ignored_tracked_items(
            tracked_items,
            ignore_rules,
        )

        watched_keys = await load_watched_keys(db)

        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        alert_items = [
            serialize_deal_alert(
                item=item,
                watched_keys=watched_keys,
                snapshot_map=snapshot_map,
                market_memory_map=memory_map,
                performance_feedback_map=feedback_map,
            )
            for item in tracked_items
        ]

        alert_items.sort(
            key=lambda item: (
                item.get("final_decision") == "Avoid",
                item["signal_priority"],
                -item.get("decision_score", 0),
                -item.get("feedback_adjustment", 0),
                -item.get("memory_score", 0),
                item["capital_risk_label"] == "Avoid",
                item["capital_risk_label"] == "High",
                -item["liquidity_score"],
                -item["opportunity_score"],
                -item["volume"],
            )
        )

        alert_items = alert_items[:limit]

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "alert_count": len(alert_items),
            "ignored_count": ignored_count,
            "top_alert": alert_items[0] if alert_items else None,
            "summary": build_deal_summary(alert_items),
            "items": alert_items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
            "alert_count": 0,
            "ignored_count": 0,
            "top_alert": None,
            "summary": build_deal_summary([]),
            "items": [],
        }


@router.post("/deals/auto-watch")
async def auto_watch_deals(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    try:
        realm_name = await get_realm_display_name(connected_realm_id)

        tracked_result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == connected_realm_id)
            .order_by(
                TrackedItem.opportunity_score.desc(),
                TrackedItem.volume.desc(),
                TrackedItem.current_price.desc(),
            )
        )

        tracked_items = tracked_result.scalars().all()

        ignore_rules = await get_active_ignore_rules(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        tracked_items, ignored_count = filter_ignored_tracked_items(
            tracked_items,
            ignore_rules,
        )

        watched_keys = await load_watched_keys(db)

        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        alert_items = [
            serialize_deal_alert(
                item=item,
                watched_keys=watched_keys,
                snapshot_map=snapshot_map,
                market_memory_map=memory_map,
                performance_feedback_map=feedback_map,
            )
            for item in tracked_items
        ]

        auto_watch_candidates = [
            alert
            for alert in alert_items
            if should_auto_watch(alert)
        ]

        auto_watch_candidates.sort(
            key=lambda item: (
                item.get("final_decision") == "Avoid",
                item["signal_priority"],
                -item.get("decision_score", 0),
                -item["signal_confidence"],
                -item.get("feedback_adjustment", 0),
                -item["memory_score"],
                -item["liquidity_score"],
                -item["opportunity_score"],
                -item["volume"],
            )
        )

        auto_watch_candidates = auto_watch_candidates[:limit]

        added_items = []

        for alert in auto_watch_candidates:
            existing_result = await db.execute(
                select(WatchlistItem).where(
                    WatchlistItem.realm_id == alert["realm_id"],
                    WatchlistItem.item_id == alert["item_id"],
                )
            )

            existing_item = existing_result.scalars().first()

            if existing_item:
                continue

            new_item = WatchlistItem(
                item_id=alert["item_id"],
                realm_id=alert["realm_id"],
                realm_name=realm_name,
                name=alert["name"],
                current_price=alert["current_price"],
                volume=alert["volume"],
                listing_count=alert["listing_count"],
                opportunity_score=alert["opportunity_score"],
                risk_level=alert["risk_level"],
                reason=alert["signal_reason"],
                icon_url=alert["icon_url"],
                quality=alert["quality"],
                item_class=alert["item_class"],
                item_subclass=alert["item_subclass"],
                goldsmith_category=alert["goldsmith_category"],
                profit_margin=alert["profit_margin"],
            )

            db.add(new_item)

            added_items.append(alert)

        await db.commit()

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "auto_watch_added": len(added_items),
            "ignored_count": ignored_count,
            "items": added_items,
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "auto_watch_added": 0,
            "ignored_count": 0,
            "items": [],
            "error": str(error),
        }
