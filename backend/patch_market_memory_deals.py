from pathlib import Path

deals_path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\deals.py")
text = deals_path.read_text()

if "from app.services.market_memory import" not in text:
    text = text.replace(
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules",
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules\nfrom app.services.market_memory import build_market_memory_map, empty_market_memory",
    )

old_signature = '''def serialize_deal_alert(
    item: TrackedItem,
    watched_keys: set[tuple[int, int]],
    snapshot_map: dict[int, list[PriceSnapshot]],
) -> dict:
'''

new_signature = '''def serialize_deal_alert(
    item: TrackedItem,
    watched_keys: set[tuple[int, int]],
    snapshot_map: dict[int, list[PriceSnapshot]],
    market_memory_map: dict[int, dict] | None = None,
) -> dict:
'''

if old_signature in text:
    text = text.replace(old_signature, new_signature)

old_memory_insert_target = '''    is_watched = (item.realm_id, item.item_id) in watched_keys

    return {
'''

new_memory_insert_target = '''    market_memory = (
        market_memory_map.get(item.item_id)
        if market_memory_map and market_memory_map.get(item.item_id)
        else empty_market_memory(
            item_id=item.item_id,
            current_price=item.current_price,
        )
    )

    is_watched = (item.realm_id, item.item_id) in watched_keys

    return {
'''

if old_memory_insert_target in text and "memory_price_state" not in text:
    text = text.replace(old_memory_insert_target, new_memory_insert_target, 1)

old_return_insert = '''        "suggested_buy_quantity": suggested_quantity,
        **price_targets,
'''

new_return_insert = '''        "suggested_buy_quantity": suggested_quantity,
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
'''

if old_return_insert in text and '"memory_price_state":' not in text:
    text = text.replace(old_return_insert, new_return_insert, 1)

snapshot_block = '''        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

'''

memory_block = '''        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

'''

if "memory_map = await build_market_memory_map" not in text:
    text = text.replace(snapshot_block, memory_block, 2)

old_call = '''                snapshot_map=snapshot_map,
            )
'''

new_call = '''                snapshot_map=snapshot_map,
                market_memory_map=memory_map,
            )
'''

if "market_memory_map=memory_map" not in text:
    text = text.replace(old_call, new_call)

text = text.replace(
    '''                item["signal_priority"],
                -item["signal_confidence"],
                item["capital_risk_label"] == "Avoid",
''',
    '''                item["signal_priority"],
                -item["signal_confidence"],
                -item.get("memory_score", 0),
                item["capital_risk_label"] == "Avoid",
''',
    1,
)

deals_path.write_text(text)

print("deals.py patched with Market Memory.")
