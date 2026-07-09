from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import IgnoreRule


def _normalise(value) -> str:
    if value is None:
        return ""

    return str(value).strip().lower()


def _get_value(item, field_name: str, default=None):
    if isinstance(item, dict):
        return item.get(field_name, default)

    return getattr(item, field_name, default)


def serialize_ignore_rule(rule: IgnoreRule) -> dict:
    return {
        "id": rule.id,
        "rule_type": rule.rule_type,
        "item_id": rule.item_id,
        "realm_id": rule.realm_id,
        "item_name": rule.item_name,
        "category": rule.category,
        "keyword": rule.keyword,
        "risk_level": rule.risk_level,
        "reason": rule.reason,
        "is_active": rule.is_active,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


async def get_active_ignore_rules(
    db: AsyncSession,
    connected_realm_id: int | None = None,
) -> list[IgnoreRule]:
    query = select(IgnoreRule).where(IgnoreRule.is_active == True)

    if connected_realm_id is not None:
        query = query.where(
            or_(
                IgnoreRule.realm_id == connected_realm_id,
                IgnoreRule.realm_id.is_(None),
            )
        )

    result = await db.execute(
        query.order_by(IgnoreRule.created_at.desc())
    )

    return list(result.scalars().all())


def item_matches_ignore_rule(item, rule: IgnoreRule) -> bool:
    if not rule.is_active:
        return False

    rule_type = _normalise(rule.rule_type)

    item_id = _get_value(item, "item_id")
    realm_id = _get_value(item, "realm_id")
    name = _normalise(_get_value(item, "name"))
    category = _normalise(_get_value(item, "goldsmith_category"))
    risk_level = _normalise(_get_value(item, "risk_level"))

    if rule.realm_id is not None and realm_id != rule.realm_id:
        return False

    if rule_type == "item":
        return rule.item_id is not None and item_id == rule.item_id

    if rule_type == "category":
        return bool(rule.category) and category == _normalise(rule.category)

    if rule_type == "keyword":
        return bool(rule.keyword) and _normalise(rule.keyword) in name

    if rule_type == "risk_profile":
        matches_risk = bool(rule.risk_level) and risk_level == _normalise(rule.risk_level)
        matches_category = (
            True
            if not rule.category
            else category == _normalise(rule.category)
        )

        return matches_risk and matches_category

    return False


def item_is_ignored(item, rules: list[IgnoreRule]) -> bool:
    return any(item_matches_ignore_rule(item, rule) for rule in rules)


def filter_ignored_tracked_items(items, rules: list[IgnoreRule]):
    filtered_items = []
    ignored_count = 0

    for item in items:
        if item_is_ignored(item, rules):
            ignored_count += 1
            continue

        filtered_items.append(item)

    return filtered_items, ignored_count
