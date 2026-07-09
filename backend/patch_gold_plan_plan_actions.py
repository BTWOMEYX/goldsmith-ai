from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\gold_plan.py")
text = path.read_text()

if "from app.services.plan_item_actions import get_plan_action_suppression_summary" not in text:
    text = text.replace(
        "from app.services.performance_feedback import build_feedback_adjustment_map",
        "from app.services.performance_feedback import build_feedback_adjustment_map\nfrom app.services.plan_item_actions import get_plan_action_suppression_summary",
    )

if 'if item.get("plan_action_hidden"):' not in text:
    text = text.replace(
        '''    if item.get("already_queued_or_tracked"):
        return False
''',
        '''    if item.get("already_queued_or_tracked"):
        return False

    if item.get("plan_action_hidden"):
        return False
''',
    )

if "plan_action_summary = await get_plan_action_suppression_summary" not in text:
    text = text.replace(
        '''        excluded_item_ids = await load_excluded_item_ids(
            db=db,
            connected_realm_id=connected_realm_id,
        )
''',
        '''        excluded_item_ids = await load_excluded_item_ids(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        plan_action_summary = await get_plan_action_suppression_summary(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        plan_action_item_ids = set(plan_action_summary["item_ids"])
''',
    )

if 'alert["plan_action_hidden"] = item.item_id in plan_action_item_ids' not in text:
    text = text.replace(
        '''            alert["already_queued_or_tracked"] = item.item_id in excluded_item_ids

            alert_items.append(alert)
''',
        '''            alert["already_queued_or_tracked"] = item.item_id in excluded_item_ids
            alert["plan_action_hidden"] = item.item_id in plan_action_item_ids

            alert_items.append(alert)
''',
    )

if "plan_action_hidden_count = len(" not in text:
    text = text.replace(
        '''        duplicate_count = len(
            [
                item
                for item in alert_items
                if item.get("already_queued_or_tracked")
            ]
        )
''',
        '''        duplicate_count = len(
            [
                item
                for item in alert_items
                if item.get("already_queued_or_tracked")
            ]
        )

        plan_action_hidden_count = len(
            [
                item
                for item in alert_items
                if item.get("plan_action_hidden")
            ]
        )

        plan_action_counts = plan_action_summary["counts"]
''',
    )

if '"plan_action_hidden_count": plan_action_hidden_count,' not in text:
    text = text.replace(
        '''            "already_queued_or_tracked_count": duplicate_count,
            "max_per_category": max_per_category,
''',
        '''            "already_queued_or_tracked_count": duplicate_count,
            "plan_action_hidden_count": plan_action_hidden_count,
            "skipped_today_count": plan_action_counts.get("skipped_today", 0),
            "snoozed_count": plan_action_counts.get("snoozed", 0),
            "plan_ignored_count": plan_action_counts.get("ignored", 0),
            "max_per_category": max_per_category,
''',
        1,
    )

if '"plan_action_hidden_count": 0,' not in text:
    text = text.replace(
        '''            "already_queued_or_tracked_count": 0,
            "max_per_category": 2,
''',
        '''            "already_queued_or_tracked_count": 0,
            "plan_action_hidden_count": 0,
            "skipped_today_count": 0,
            "snoozed_count": 0,
            "plan_ignored_count": 0,
            "max_per_category": 2,
''',
    )

path.write_text(text)

print("gold_plan.py patched with Plan Item Action exclusions.")
