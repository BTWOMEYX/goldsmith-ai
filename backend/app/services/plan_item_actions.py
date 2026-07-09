from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import PlanItemAction

ACTION_SKIPPED_TODAY = "skipped_today"
ACTION_SNOOZED = "snoozed"
ACTION_IGNORED = "ignored"

ACTIVE_SUPPRESSION_ACTIONS = {
    ACTION_SKIPPED_TODAY,
    ACTION_SNOOZED,
    ACTION_IGNORED,
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_expiry_for_action(
    action_type: str,
    snooze_hours: int = 24,
) -> datetime | None:
    now = utc_now()

    if action_type == ACTION_SKIPPED_TODAY:
        return now + timedelta(hours=18)

    if action_type == ACTION_SNOOZED:
        safe_hours = max(1, min(int(snooze_hours or 24), 168))
        return now + timedelta(hours=safe_hours)

    if action_type == ACTION_IGNORED:
        return None

    return now + timedelta(hours=24)


def serialize_plan_action(action: PlanItemAction) -> dict:
    return {
        "id": action.id,
        "item_id": action.item_id,
        "realm_id": action.realm_id,
        "item_name": action.item_name,
        "action_type": action.action_type,
        "reason": action.reason,
        "expires_at": action.expires_at.isoformat() if action.expires_at else None,
        "is_active": action.is_active,
        "created_at": action.created_at.isoformat() if action.created_at else None,
        "updated_at": action.updated_at.isoformat() if action.updated_at else None,
    }


async def get_active_plan_actions(
    db: AsyncSession,
    connected_realm_id: int,
) -> list[PlanItemAction]:
    now = utc_now()

    result = await db.execute(
        select(PlanItemAction)
        .where(PlanItemAction.realm_id == connected_realm_id)
        .where(PlanItemAction.is_active == True)
        .where(PlanItemAction.action_type.in_(ACTIVE_SUPPRESSION_ACTIONS))
        .where(
            or_(
                PlanItemAction.expires_at.is_(None),
                PlanItemAction.expires_at > now,
            )
        )
        .order_by(PlanItemAction.created_at.desc())
    )

    return list(result.scalars().all())


async def get_plan_action_suppression_summary(
    db: AsyncSession,
    connected_realm_id: int,
) -> dict:
    actions = await get_active_plan_actions(
        db=db,
        connected_realm_id=connected_realm_id,
    )

    item_ids = {
        action.item_id
        for action in actions
    }

    counts = {
        ACTION_SKIPPED_TODAY: 0,
        ACTION_SNOOZED: 0,
        ACTION_IGNORED: 0,
    }

    for action in actions:
        if action.action_type in counts:
            counts[action.action_type] += 1

    return {
        "item_ids": sorted(item_ids),
        "counts": counts,
        "actions": [serialize_plan_action(action) for action in actions],
    }


async def create_or_update_plan_action(
    db: AsyncSession,
    item_id: int,
    realm_id: int,
    action_type: str,
    item_name: str | None = None,
    reason: str | None = None,
    snooze_hours: int = 24,
) -> PlanItemAction:
    normalised_action = action_type.strip().lower()

    if normalised_action not in ACTIVE_SUPPRESSION_ACTIONS:
        raise ValueError(
            f"Unsupported plan action '{action_type}'."
        )

    existing_result = await db.execute(
        select(PlanItemAction)
        .where(PlanItemAction.item_id == item_id)
        .where(PlanItemAction.realm_id == realm_id)
        .where(PlanItemAction.is_active == True)
    )

    existing_actions = list(existing_result.scalars().all())

    for existing in existing_actions:
        existing.is_active = False
        existing.updated_at = utc_now()

    new_action = PlanItemAction(
        item_id=item_id,
        realm_id=realm_id,
        item_name=item_name,
        action_type=normalised_action,
        reason=reason,
        expires_at=get_expiry_for_action(
            action_type=normalised_action,
            snooze_hours=snooze_hours,
        ),
        is_active=True,
    )

    db.add(new_action)

    await db.commit()
    await db.refresh(new_action)

    return new_action


async def deactivate_plan_action(
    db: AsyncSession,
    action_id: int,
) -> PlanItemAction | None:
    result = await db.execute(
        select(PlanItemAction).where(PlanItemAction.id == action_id)
    )

    action = result.scalars().first()

    if not action:
        return None

    action.is_active = False
    action.updated_at = utc_now()

    await db.commit()
    await db.refresh(action)

    return action
