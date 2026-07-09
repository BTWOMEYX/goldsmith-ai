from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.plan_item_actions import (
    ACTION_IGNORED,
    ACTION_SKIPPED_TODAY,
    ACTION_SNOOZED,
    create_or_update_plan_action,
    deactivate_plan_action,
    get_plan_action_suppression_summary,
    serialize_plan_action,
)
from database import get_db

router = APIRouter(
    prefix="/api",
    tags=["Plan Item Actions"],
)


class PlanItemActionPayload(BaseModel):
    item_id: int
    realm_id: int
    item_name: str | None = None
    reason: str | None = None
    snooze_hours: int = Field(default=24, ge=1, le=168)


async def create_action_response(
    db: AsyncSession,
    payload: PlanItemActionPayload,
    action_type: str,
):
    try:
        action = await create_or_update_plan_action(
            db=db,
            item_id=payload.item_id,
            realm_id=payload.realm_id,
            item_name=payload.item_name,
            action_type=action_type,
            reason=payload.reason,
            snooze_hours=payload.snooze_hours,
        )

        return {
            "status": "Success",
            "action": serialize_plan_action(action),
        }

    except ValueError as error:
        return {
            "status": "Error",
            "error": str(error),
            "action": None,
        }


@router.get("/plan-actions/summary")
async def get_plan_actions_summary(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    summary = await get_plan_action_suppression_summary(
        db=db,
        connected_realm_id=connected_realm_id,
    )

    return {
        "status": "Success",
        "connected_realm_id": connected_realm_id,
        **summary,
    }


@router.post("/plan-actions/skip-today")
async def skip_today(
    payload: PlanItemActionPayload,
    db: AsyncSession = Depends(get_db),
):
    return await create_action_response(
        db=db,
        payload=payload,
        action_type=ACTION_SKIPPED_TODAY,
    )


@router.post("/plan-actions/snooze")
async def snooze_item(
    payload: PlanItemActionPayload,
    db: AsyncSession = Depends(get_db),
):
    return await create_action_response(
        db=db,
        payload=payload,
        action_type=ACTION_SNOOZED,
    )


@router.post("/plan-actions/ignore")
async def ignore_item_from_plan(
    payload: PlanItemActionPayload,
    db: AsyncSession = Depends(get_db),
):
    return await create_action_response(
        db=db,
        payload=payload,
        action_type=ACTION_IGNORED,
    )


@router.delete("/plan-actions/{action_id}")
async def remove_plan_action(
    action_id: int,
    db: AsyncSession = Depends(get_db),
):
    action = await deactivate_plan_action(
        db=db,
        action_id=action_id,
    )

    if not action:
        return {
            "status": "Error",
            "error": "Plan action not found.",
        }

    return {
        "status": "Success",
        "action": serialize_plan_action(action),
    }
