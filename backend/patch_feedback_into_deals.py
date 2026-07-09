from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\deals.py")
text = path.read_text()

if "from app.services.performance_feedback import" not in text:
    text = text.replace(
        "from app.services.market_memory import build_market_memory_map, empty_market_memory",
        "from app.services.market_memory import build_market_memory_map, empty_market_memory\nfrom app.services.performance_feedback import build_feedback_adjustment_map, combine_performance_feedback_adjustments",
    )

text = text.replace(
    """    market_memory_map: dict[int, dict] | None = None,
) -> dict:""",
    """    market_memory_map: dict[int, dict] | None = None,
    performance_feedback_map: dict | None = None,
) -> dict:""",
)

old_confidence_block = """    memory_adjusted_confidence = apply_market_memory_to_confidence(
        base_confidence=base_confidence,
        market_memory=market_memory,
    )

    signal_data = build_deal_signal(
        item=item,
        price_change_percent=price_change_percent,
        confidence=memory_adjusted_confidence,
        market_memory=market_memory,
    )
"""

new_confidence_block = """    pre_feedback_confidence = apply_market_memory_to_confidence(
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
"""

if old_confidence_block in text:
    text = text.replace(old_confidence_block, new_confidence_block)
else:
    print("WARNING: confidence block not found.")

old_return_block = """        "signal_confidence": memory_adjusted_confidence,
        "base_signal_confidence": base_confidence,
        "memory_adjusted_confidence": memory_adjusted_confidence,
"""

new_return_block = """        "signal_confidence": memory_adjusted_confidence,
        "base_signal_confidence": base_confidence,
        "pre_feedback_confidence": pre_feedback_confidence,
        "memory_adjusted_confidence": memory_adjusted_confidence,
        "feedback_adjustment": performance_feedback["score_adjustment"],
        "feedback_label": performance_feedback["feedback_label"],
        "feedback_note": performance_feedback["feedback_note"],
        "performance_feedback": performance_feedback,
"""

if old_return_block in text:
    text = text.replace(old_return_block, new_return_block)
else:
    print("WARNING: return confidence block not found.")

old_memory_map_block = """        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )
"""

new_memory_map_block = """        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )
"""

text = text.replace(old_memory_map_block, new_memory_map_block)

text = text.replace(
    """                market_memory_map=memory_map,
            )""",
    """                market_memory_map=memory_map,
                performance_feedback_map=feedback_map,
            )""",
)

text = text.replace(
    """                -item.get("decision_score", 0),
                -item.get("memory_score", 0),""",
    """                -item.get("decision_score", 0),
                -item.get("feedback_adjustment", 0),
                -item.get("memory_score", 0),""",
)

text = text.replace(
    """                -item["signal_confidence"],
                -item["memory_score"],""",
    """                -item["signal_confidence"],
                -item.get("feedback_adjustment", 0),
                -item["memory_score"],""",
)

if "feedback_boost_count" not in text:
    text = text.replace(
        """        "avoid_capital_count": len(
            [item for item in items if item.get("capital_risk_label") == "Avoid"]
        ),
    }""",
        """        "avoid_capital_count": len(
            [item for item in items if item.get("capital_risk_label") == "Avoid"]
        ),
        "feedback_boost_count": len(
            [item for item in items if item.get("feedback_label") in ["Boost", "Positive"]]
        ),
        "feedback_caution_count": len(
            [item for item in items if item.get("feedback_label") in ["Penalty", "Caution"]]
        ),
    }""",
    )

if 'alert.get("feedback_label") == "Penalty"' not in text:
    text = text.replace(
        """    if alert.get("memory_price_state") in ["Overpriced", "Volatile"]:
        return False
""",
        """    if alert.get("memory_price_state") in ["Overpriced", "Volatile"]:
        return False

    if alert.get("feedback_label") == "Penalty" and alert.get("feedback_adjustment", 0) <= -6:
        return False
""",
    )

path.write_text(text)

print("deals.py patched with Performance Feedback scoring.")
