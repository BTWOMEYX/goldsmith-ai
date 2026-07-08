import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.services.blizzard import blizzard_service
from database import get_db
from models import PriceSnapshot, TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Sync"],
)


REALM_NAMES = {
    11: "Illidan",
    4: "Area 52",
    12: "Sargeras",
    53: "Tichondrius",
}


QUALITY_SCORE = {
    "poor": 1,
    "common": 2,
    "uncommon": 5,
    "rare": 7,
    "epic": 10,
    "legendary": 12,
    "artifact": 12,
    "heirloom": 6,
    "wow_token": 4,
}


async def get_display_data_safely(item_id: int) -> dict:
    try:
        return await asyncio.wait_for(
            blizzard_service.get_item_display_data(item_id),
            timeout=8,
        )

    except Exception as error:
        print(
            f"[ITEM METADATA WARNING] Falling back for item_id={item_id}: {error}"
        )

        return {
            "item_id": item_id,
            "name": f"Item {item_id}",
            "quality": "unknown",
            "icon_url": None,
        }


def calculate_opportunity_score(
    price: float,
    volume: int,
    listing_count: int,
    quality: str | None,
) -> float:
    quality_key = (quality or "unknown").lower()

    value_score = min(price / 100000, 1) * 30
    volume_score = min(volume / 50, 1) * 35
    listing_score = min(listing_count / 20, 1) * 25
    rarity_score = QUALITY_SCORE.get(quality_key, 3)

    score = value_score + volume_score + listing_score + rarity_score

    if volume < 10:
        score -= 18
    elif volume < 20:
        score -= 10

    if listing_count <= 3:
        score -= 10
    elif listing_count <= 6:
        score -= 5

    if price > 150000 and volume < 20:
        score -= 10

    return round(max(1, min(score, 100)), 1)


def calculate_risk_level(
    price: float,
    volume: int,
    listing_count: int,
    opportunity_score: float,
) -> str:
    if volume < 10 or listing_count <= 3:
        return "High"

    if price > 150000 and volume < 25:
        return "High"

    if opportunity_score >= 75 and volume >= 30 and listing_count >= 10:
        return "Low"

    if opportunity_score >= 50 and volume >= 12 and listing_count >= 5:
        return "Medium"

    return "High"


def build_reason(
    volume: int,
    listing_count: int,
    quality: str | None,
    opportunity_score: float,
    risk_level: str,
) -> str:
    quality_label = (quality or "unknown").capitalize()

    if risk_level == "Low":
        return (
            f"Strong opportunity: {quality_label} item with {volume} total quantity "
            f"across {listing_count} listings and a score of {opportunity_score}/100."
        )

    if risk_level == "Medium":
        return (
            f"Moderate opportunity: {quality_label} item with {volume} quantity "
            f"across {listing_count} listings. Worth reviewing before buying."
        )

    return (
        f"Higher-risk opportunity: limited market depth with {volume} quantity "
        f"across {listing_count} listings. Check sell-through before buying."
    )


async def enrich_candidate(candidate: dict, semaphore: asyncio.Semaphore) -> dict:
    async with semaphore:
        item_id = candidate["item_id"]

        display_data = await get_display_data_safely(item_id)

        opportunity_score = calculate_opportunity_score(
            price=candidate["price"],
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            quality=display_data["quality"],
        )

        risk_level = calculate_risk_level(
            price=candidate["price"],
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            opportunity_score=opportunity_score,
        )

        reason = build_reason(
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            quality=display_data["quality"],
            opportunity_score=opportunity_score,
            risk_level=risk_level,
        )

        return {
            "item_id": item_id,
            "name": display_data["name"],
            "price": candidate["price"],
            "volume": candidate["volume"],
            "listing_count": candidate["listing_count"],
            "icon_url": display_data["icon_url"],
            "quality": display_data["quality"],
            "opportunity_score": opportunity_score,
            "risk_level": risk_level,
            "reason": reason,
        }


@router.post("/sync-auctions")
async def sync_auctions(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        realm_name = REALM_NAMES.get(
            connected_realm_id,
            f"Connected Realm {connected_realm_id}",
        )

        print(
            f"[SYNC] Starting auction sync for connected_realm_id={connected_realm_id}"
        )

        data = await blizzard_service.get_auction_house_data(
            connected_realm_id=connected_realm_id
        )

        if not data or "auctions" not in data:
            return {
                "status": "Sync Aborted",
                "message": "Invalid auction payload from Blizzard API.",
            }

        auctions = data.get("auctions", [])

        print(f"[SYNC] Auctions downloaded: {len(auctions)}")

        item_stats: dict[int, dict[str, float | int]] = {}

        for auction in auctions:
            item = auction.get("item", {})
            item_id = item.get("id")

            if not item_id:
                continue

            raw_price = (
                auction.get("unit_price")
                or auction.get("buyout")
                or auction.get("bid")
                or 0
            )

            if raw_price <= 0:
                continue

            price_gold = raw_price / 10000
            quantity = auction.get("quantity", 1)

            if not 5.0 <= price_gold <= 200000.0:
                continue

            if item_id not in item_stats:
                item_stats[item_id] = {
                    "min_price": price_gold,
                    "volume": 0,
                    "listing_count": 0,
                }

            item_stats[item_id]["min_price"] = min(
                float(item_stats[item_id]["min_price"]),
                price_gold,
            )

            item_stats[item_id]["volume"] = int(item_stats[item_id]["volume"]) + int(
                quantity
            )

            item_stats[item_id]["listing_count"] = (
                int(item_stats[item_id]["listing_count"]) + 1
            )

        candidates = []

        for item_id, stats in item_stats.items():
            price = float(stats["min_price"])
            volume = int(stats["volume"])
            listing_count = int(stats["listing_count"])

            if volume < 6:
                continue

            preliminary_score = (
                min(price / 100000, 1) * 40
                + min(volume / 50, 1) * 35
                + min(listing_count / 20, 1) * 25
            )

            candidates.append(
                {
                    "item_id": item_id,
                    "price": round(price, 2),
                    "volume": volume,
                    "listing_count": listing_count,
                    "preliminary_score": round(preliminary_score, 1),
                }
            )

        candidates.sort(
            key=lambda item: (
                item["preliminary_score"],
                item["volume"],
                item["price"],
            ),
            reverse=True,
        )

        metadata_pool = candidates[:15]

        print(
            f"[SYNC] Candidates found={len(candidates)}. "
            f"Fetching metadata for top {len(metadata_pool)} items..."
        )

        semaphore = asyncio.Semaphore(8)

        enriched_candidates = await asyncio.gather(
            *[
                enrich_candidate(candidate, semaphore)
                for candidate in metadata_pool
            ]
        )

        enriched_candidates.sort(
            key=lambda item: (
                item["opportunity_score"],
                item["volume"],
                item["price"],
            ),
            reverse=True,
        )

        top_opportunities = enriched_candidates[:15]

        await db.execute(
            delete(TrackedItem).where(
                TrackedItem.realm_id == connected_realm_id
            )
        )

        await db.flush()

        for opportunity in top_opportunities:
            tracked_item = TrackedItem(
                item_id=opportunity["item_id"],
                realm_id=connected_realm_id,
                name=opportunity["name"],
                current_price=opportunity["price"],
                volume=opportunity["volume"],
                listing_count=opportunity["listing_count"],
                opportunity_score=opportunity["opportunity_score"],
                risk_level=opportunity["risk_level"],
                reason=opportunity["reason"],
                icon_url=opportunity["icon_url"],
                quality=opportunity["quality"],
                profit_margin=opportunity["opportunity_score"],
            )

            price_snapshot = PriceSnapshot(
                item_id=opportunity["item_id"],
                realm_id=connected_realm_id,
                realm_name=realm_name,
                name=opportunity["name"],
                current_price=opportunity["price"],
                volume=opportunity["volume"],
                listing_count=opportunity["listing_count"],
                opportunity_score=opportunity["opportunity_score"],
                risk_level=opportunity["risk_level"],
                reason=opportunity["reason"],
                icon_url=opportunity["icon_url"],
                quality=opportunity["quality"],
                profit_margin=opportunity["opportunity_score"],
            )

            db.add(tracked_item)
            db.add(price_snapshot)

        await db.commit()

        print(
            f"[SYNC] Completed. Items scanned={len(item_stats)}, "
            f"candidates={len(candidates)}, "
            f"metadata_enriched={len(enriched_candidates)}, "
            f"opportunities={len(top_opportunities)}, "
            f"snapshots_saved={len(top_opportunities)}"
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "auctions_downloaded": len(auctions),
            "items_scanned": len(item_stats),
            "candidates_found": len(candidates),
            "metadata_enriched": len(enriched_candidates),
            "opportunities_unlocked": len(top_opportunities),
            "snapshots_saved": len(top_opportunities),
        }

    except Exception as error:
        await db.rollback()

        print(f"[SYNC ERROR] {str(error)}")

        return {
            "status": "Sync Failed",
            "error": str(error),
        }