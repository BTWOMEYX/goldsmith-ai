STRATEGY_PROFILE_KEY = "balanced"

FAST_CATEGORIES = {
    "Crafting Materials",
    "Consumables",
    "Enchants",
    "Gems",
    "Glyphs",
}

COLLECTOR_CATEGORIES = {
    "Gear / Transmog",
    "Recipes / Plans",
    "Battle Pets",
    "Rare / Collector Items",
}


STRATEGY_PROFILES = {
    "learning": {
        "id": "learning",
        "label": "Learning Mode",
        "description": "Very cautious while GoldSmith gathers trade results.",
        "min_decision_score": 72,
        "allowed_risks": ["low"],
        "allowed_sale_speeds": ["Fast", "Medium"],
        "allowed_categories": [],
        "blocked_categories": [],
        "quantity_multiplier": 0.50,
        "max_quantity": 2,
        "max_exposure": 25000,
        "min_margin_percent": 8,
        "min_memory_score": 45,
        "allow_learning_memory": True,
        "allow_volatile_memory": False,
        "feedback_multiplier": 0.50,
        "score_bias": -4,
    },
    "safe": {
        "id": "safe",
        "label": "Safe Flipper",
        "description": "Low-risk, fast-selling flips with tight capital control.",
        "min_decision_score": 70,
        "allowed_risks": ["low"],
        "allowed_sale_speeds": ["Fast", "Medium"],
        "allowed_categories": [],
        "blocked_categories": [],
        "quantity_multiplier": 0.75,
        "max_quantity": 5,
        "max_exposure": 60000,
        "min_margin_percent": 7,
        "min_memory_score": 45,
        "allow_learning_memory": True,
        "allow_volatile_memory": False,
        "feedback_multiplier": 0.75,
        "score_bias": 0,
    },
    "balanced": {
        "id": "balanced",
        "label": "Balanced",
        "description": "Default profile. Allows medium risk with controlled exposure.",
        "min_decision_score": 62,
        "allowed_risks": ["low", "medium"],
        "allowed_sale_speeds": ["Fast", "Medium", "Slow"],
        "allowed_categories": [],
        "blocked_categories": [],
        "quantity_multiplier": 1.00,
        "max_quantity": 20,
        "max_exposure": 150000,
        "min_margin_percent": 4,
        "min_memory_score": 35,
        "allow_learning_memory": True,
        "allow_volatile_memory": False,
        "feedback_multiplier": 1.00,
        "score_bias": 0,
    },
    "aggressive": {
        "id": "aggressive",
        "label": "Aggressive Sniper",
        "description": "Higher upside, deeper discounts, more tolerance for risk.",
        "min_decision_score": 58,
        "allowed_risks": ["low", "medium", "high"],
        "allowed_sale_speeds": ["Fast", "Medium", "Slow"],
        "allowed_categories": [],
        "blocked_categories": [],
        "quantity_multiplier": 0.85,
        "max_quantity": 8,
        "max_exposure": 250000,
        "min_margin_percent": 10,
        "min_memory_score": 30,
        "allow_learning_memory": True,
        "allow_volatile_memory": True,
        "feedback_multiplier": 1.25,
        "score_bias": 3,
    },
    "high_volume": {
        "id": "high_volume",
        "label": "High Volume",
        "description": "Prioritises fast-moving stackables and quick turnover.",
        "min_decision_score": 60,
        "allowed_risks": ["low", "medium"],
        "allowed_sale_speeds": ["Fast", "Medium"],
        "allowed_categories": sorted(FAST_CATEGORIES),
        "blocked_categories": [],
        "quantity_multiplier": 1.45,
        "max_quantity": 40,
        "max_exposure": 180000,
        "min_margin_percent": 3,
        "min_memory_score": 35,
        "allow_learning_memory": True,
        "allow_volatile_memory": False,
        "feedback_multiplier": 1.10,
        "score_bias": 4,
    },
    "collector": {
        "id": "collector",
        "label": "Collector / Transmog",
        "description": "Allows slow rare flips, but demands bigger margins and tiny positions.",
        "min_decision_score": 64,
        "allowed_risks": ["low", "medium"],
        "allowed_sale_speeds": ["Medium", "Slow"],
        "allowed_categories": sorted(COLLECTOR_CATEGORIES),
        "blocked_categories": [],
        "quantity_multiplier": 0.35,
        "max_quantity": 1,
        "max_exposure": 120000,
        "min_margin_percent": 25,
        "min_memory_score": 30,
        "allow_learning_memory": True,
        "allow_volatile_memory": False,
        "feedback_multiplier": 1.00,
        "score_bias": 2,
    },
}


def get_available_strategy_profiles() -> list[dict]:
    return list(STRATEGY_PROFILES.values())


def get_active_strategy_id() -> str:
    global STRATEGY_PROFILE_KEY

    if STRATEGY_PROFILE_KEY not in STRATEGY_PROFILES:
        STRATEGY_PROFILE_KEY = "balanced"

    return STRATEGY_PROFILE_KEY


def get_active_strategy_profile() -> dict:
    return STRATEGY_PROFILES[get_active_strategy_id()]


def set_active_strategy_profile(profile_id: str) -> dict:
    global STRATEGY_PROFILE_KEY

    normalised = profile_id.strip().lower()

    if normalised not in STRATEGY_PROFILES:
        raise ValueError(
            f"Unknown strategy profile '{profile_id}'. Allowed profiles: {', '.join(STRATEGY_PROFILES.keys())}"
        )

    STRATEGY_PROFILE_KEY = normalised

    return get_active_strategy_profile()


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def apply_strategy_to_alert(alert: dict, strategy: dict | None = None) -> dict:
    active_strategy = strategy or get_active_strategy_profile()
    adjusted = dict(alert)

    category = adjusted.get("goldsmith_category") or "Unknown / Other"
    risk = str(adjusted.get("risk_level") or "").lower()
    sale_speed = adjusted.get("sale_speed")
    memory_state = adjusted.get("memory_price_state")
    memory_score = float(adjusted.get("memory_score") or 0)
    margin_percent = float(
        adjusted.get("estimated_net_margin_percent")
        or adjusted.get("estimated_margin_percent")
        or 0
    )
    exposure = float(adjusted.get("max_gold_exposure") or 0)
    decision_score = float(adjusted.get("decision_score") or 0)
    feedback_adjustment = float(adjusted.get("feedback_adjustment") or 0)

    blocked_reasons = []
    strategy_adjustment = float(active_strategy.get("score_bias", 0))

    allowed_categories = active_strategy.get("allowed_categories") or []
    blocked_categories = active_strategy.get("blocked_categories") or []
    allowed_risks = active_strategy.get("allowed_risks") or []
    allowed_sale_speeds = active_strategy.get("allowed_sale_speeds") or []

    if allowed_categories and category not in allowed_categories:
        blocked_reasons.append(f"{category} is outside the {active_strategy['label']} category focus.")

    if category in blocked_categories:
        blocked_reasons.append(f"{category} is blocked by the active strategy.")

    if allowed_risks and risk not in allowed_risks:
        blocked_reasons.append(f"{risk or 'unknown'} risk is not allowed by {active_strategy['label']}.")

    if allowed_sale_speeds and sale_speed not in allowed_sale_speeds:
        blocked_reasons.append(f"{sale_speed or 'Unknown'} sale speed is not allowed by {active_strategy['label']}.")

    if memory_state == "Volatile" and not active_strategy.get("allow_volatile_memory", False):
        blocked_reasons.append("Volatile memory state is blocked by this strategy.")

    if memory_state == "Learning" and not active_strategy.get("allow_learning_memory", True):
        blocked_reasons.append("Learning memory state is blocked by this strategy.")

    if memory_score < float(active_strategy.get("min_memory_score", 0)):
        strategy_adjustment -= 4

    if margin_percent < float(active_strategy.get("min_margin_percent", 0)):
        strategy_adjustment -= 5
        blocked_reasons.append(
            f"Net margin {round(margin_percent, 1)}% is below the {active_strategy['label']} requirement."
        )

    max_exposure = float(active_strategy.get("max_exposure", 0))

    if max_exposure > 0 and exposure > max_exposure:
        strategy_adjustment -= 6
        blocked_reasons.append(
            f"Exposure {round(exposure)}g is above the strategy cap of {round(max_exposure)}g."
        )

    feedback_multiplier = float(active_strategy.get("feedback_multiplier", 1))
    feedback_delta = feedback_adjustment * (feedback_multiplier - 1)

    strategy_adjustment += feedback_delta

    original_quantity = int(adjusted.get("suggested_buy_quantity") or 0)
    quantity_multiplier = float(active_strategy.get("quantity_multiplier", 1))
    max_quantity = int(active_strategy.get("max_quantity", original_quantity or 0))

    if original_quantity > 0:
        strategy_quantity = int(original_quantity * quantity_multiplier)

        if quantity_multiplier > 1 and strategy_quantity <= original_quantity:
            strategy_quantity = original_quantity + 1

        strategy_quantity = max(1, strategy_quantity)
        strategy_quantity = min(strategy_quantity, max_quantity)
    else:
        strategy_quantity = 0

    strategy_score = round(
        clamp(
            decision_score + strategy_adjustment,
            1,
            100,
        ),
        1,
    )

    min_decision_score = float(active_strategy.get("min_decision_score", 0))

    strategy_blocked = bool(blocked_reasons) or strategy_score < min_decision_score

    if strategy_score < min_decision_score:
        blocked_reasons.append(
            f"Strategy score {strategy_score} is below required {round(min_decision_score)}."
        )

    if strategy_blocked:
        final_decision = "Avoid"
        decision_grade = "D"
        buy_pressure = "None"
        position_size_label = "No position"
        strategy_quantity = 0
    elif strategy_score >= 88:
        final_decision = "Strong Buy"
        decision_grade = "S"
        buy_pressure = "Very High"
        position_size_label = "Strategy-approved position"
    elif strategy_score >= 78:
        final_decision = "Buy"
        decision_grade = "A"
        buy_pressure = "High"
        position_size_label = "Strategy-approved position"
    elif strategy_score >= 66:
        final_decision = "Small Buy"
        decision_grade = "B"
        buy_pressure = "Medium"
        position_size_label = "Strategy-capped position"
    elif strategy_score >= 54:
        final_decision = "Watch"
        decision_grade = "C"
        buy_pressure = "Low"
        position_size_label = "Watch only"
        strategy_quantity = 0
    else:
        final_decision = "Avoid"
        decision_grade = "D"
        buy_pressure = "None"
        position_size_label = "No position"
        strategy_quantity = 0

    max_price_each = float(adjusted.get("suggested_buy_below") or 0)
    max_gold_exposure = round(strategy_quantity * max_price_each, 2)

    adjusted["strategy_profile_id"] = active_strategy["id"]
    adjusted["strategy_profile_label"] = active_strategy["label"]
    adjusted["strategy_adjustment"] = round(strategy_adjustment, 1)
    adjusted["strategy_score"] = strategy_score
    adjusted["strategy_blocked"] = strategy_blocked
    adjusted["strategy_blocked_reasons"] = blocked_reasons
    adjusted["strategy_quantity_before"] = original_quantity

    adjusted["decision_score"] = strategy_score
    adjusted["final_decision"] = final_decision
    adjusted["decision_grade"] = decision_grade
    adjusted["buy_pressure"] = buy_pressure
    adjusted["position_size_label"] = position_size_label
    adjusted["suggested_buy_quantity"] = strategy_quantity
    adjusted["max_gold_exposure"] = max_gold_exposure

    if strategy_blocked:
        adjusted["strategy_note"] = (
            f"{active_strategy['label']} blocked this item: "
            + " ".join(blocked_reasons[:3])
        )
        adjusted["decision_note"] = adjusted["strategy_note"]
        adjusted["capital_action"] = "Do not buy"
        adjusted["capital_risk_label"] = "Avoid"
        adjusted["buy_strategy"] = f"Blocked by {active_strategy['label']}"
    else:
        adjusted["strategy_note"] = (
            f"{active_strategy['label']} approved this item with strategy score {strategy_score} "
            f"and quantity {strategy_quantity}."
        )

    return adjusted
