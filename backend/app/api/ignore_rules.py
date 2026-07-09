from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.services.ignore_rules import serialize_ignore_rule
from database import get_db
from models import IgnoreRule

router = APIRouter(
    prefix="/api",
    tags=["Ignore Rules"],
)


class IgnoreRulePayload(BaseModel):
    rule_type: str
    item_id: int | None = None
    realm_id: int | None = None
    item_name: str | None = None
    category: str | None = None
    keyword: str | None = None
    risk_level: str | None = None
    reason: str | None = None


class IgnoreItemPayload(BaseModel):
    item_id: int
    realm_id: int | None = None
    item_name: str | None = None
    reason: str | None = None


class IgnoreCategoryPayload(BaseModel):
    category: str
    realm_id: int | None = None
    reason: str | None = None


class IgnoreKeywordPayload(BaseModel):
    keyword: str
    realm_id: int | None = None
    reason: str | None = None


@router.get("/ignore-rules")
async def get_ignore_rules(
    connected_realm_id: int | None = Query(default=None),
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    query = select(IgnoreRule)

    if active_only:
        query = query.where(IgnoreRule.is_active == True)

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

    rules = result.scalars().all()

    return {
        "status": "Success",
        "rule_count": len(rules),
        "items": [serialize_ignore_rule(rule) for rule in rules],
    }


@router.post("/ignore-rules")
async def create_ignore_rule(
    payload: IgnoreRulePayload,
    db: AsyncSession = Depends(get_db),
):
    rule = IgnoreRule(
        rule_type=payload.rule_type,
        item_id=payload.item_id,
        realm_id=payload.realm_id,
        item_name=payload.item_name,
        category=payload.category,
        keyword=payload.keyword,
        risk_level=payload.risk_level,
        reason=payload.reason,
        is_active=True,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }


@router.post("/ignore-rules/item")
async def ignore_item(
    payload: IgnoreItemPayload,
    db: AsyncSession = Depends(get_db),
):
    rule = IgnoreRule(
        rule_type="item",
        item_id=payload.item_id,
        realm_id=payload.realm_id,
        item_name=payload.item_name,
        reason=payload.reason or "Ignored manually from GoldSmith.",
        is_active=True,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }


@router.post("/ignore-rules/category")
async def ignore_category(
    payload: IgnoreCategoryPayload,
    db: AsyncSession = Depends(get_db),
):
    rule = IgnoreRule(
        rule_type="category",
        realm_id=payload.realm_id,
        category=payload.category,
        reason=payload.reason or "Category ignored manually from GoldSmith.",
        is_active=True,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }


@router.post("/ignore-rules/keyword")
async def ignore_keyword(
    payload: IgnoreKeywordPayload,
    db: AsyncSession = Depends(get_db),
):
    rule = IgnoreRule(
        rule_type="keyword",
        realm_id=payload.realm_id,
        keyword=payload.keyword,
        reason=payload.reason or "Keyword ignored manually from GoldSmith.",
        is_active=True,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }


@router.delete("/ignore-rules/{rule_id}")
async def deactivate_ignore_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IgnoreRule).where(IgnoreRule.id == rule_id)
    )

    rule = result.scalars().first()

    if not rule:
        return {
            "status": "Error",
            "error": "Ignore rule not found.",
        }

    rule.is_active = False

    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }


@router.post("/ignore-rules/{rule_id}/reactivate")
async def reactivate_ignore_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IgnoreRule).where(IgnoreRule.id == rule_id)
    )

    rule = result.scalars().first()

    if not rule:
        return {
            "status": "Error",
            "error": "Ignore rule not found.",
        }

    rule.is_active = True

    await db.commit()
    await db.refresh(rule)

    return {
        "status": "Success",
        "item": serialize_ignore_rule(rule),
    }
