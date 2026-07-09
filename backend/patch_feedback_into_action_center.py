from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\action_center.py")
text = path.read_text()

if "from app.services.performance_feedback import build_feedback_adjustment_map" not in text:
    text = text.replace(
        "from app.services.market_memory import build_market_memory_map",
        "from app.services.market_memory import build_market_memory_map\nfrom app.services.performance_feedback import build_feedback_adjustment_map",
    )

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

if old_memory_map_block in text and "feedback_map = await build_feedback_adjustment_map" not in text:
    text = text.replace(old_memory_map_block, new_memory_map_block)

text = text.replace(
    """                market_memory_map=memory_map,
            )""",
    """                market_memory_map=memory_map,
                performance_feedback_map=feedback_map,
            )""",
)

path.write_text(text)

print("action_center.py patched with Performance Feedback scoring.")
