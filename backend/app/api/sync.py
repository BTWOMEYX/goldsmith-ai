import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.blizzard import blizzard_service
from app.utils.realms import get_realm_display_name
from database import get_db
from models import MarketSnapshot, PriceSnapshot, TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Sync"],
)


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


CATEGORY_SCORE_BONUS = {
    "Crafting Materials": 10,
    "Consumables": 9,
    "Enchants": 8,
    "Gems": 8,
    "Glyphs": 7,
    "Recipes / Plans": 7,
    "Battle Pets": 5,
    "Gear / Transmog": 4,
    "Rare / Collector Items": 6,
    "Unknown / Other": 0,
}


FAST_MOVE_CATEGORIES = {
    "Crafting Materials",
    "Consumables",
    "Enchants",
    "Gems",
    "Glyphs",
}


SLOW_MOVE_CATEGORIES = {
    "Gear / Transmog",
    "Recipes / Plans",
    "Battle Pets",
    "Rare / Collector Items",
}


SCAN_CONFIGS = {
    "quick": {
        "metadata_limit": 35,
        "save_limit": 35,
        "capture_limit": 3000,
        "min_price": 25.0,
        "max_price": 200000.0,
        "capture_min_price": 5.0,
        "capture_max_price": 500000.0,
        "capture_min_volume": 3,
        "capture_min_listing_count": 1,
        "min_volume": 12,
        "min_listing_count": 5,
        "min_preliminary_score": 38.0,
        "min_final_score": 45.0,
        "allow_high_risk": False,
        "high_risk_min_score": 65.0,
        "high_risk_min_volume": 25,
    },
    "full": {
        "metadata_limit": 125,
        "save_limit": 125,
        "capture_limit": 20000,
        "min_price": 10.0,
        "max_price": 500000.0,
        "capture_min_price": 1.0,
        "capture_max_price": 1000000.0,
        "capture_min_volume": 1,
        "capture_min_listing_count": 1,
        "min_volume": 8,
        "min_listing_count": 3,
        "min_preliminary_score": 28.0,
        "min_final_score": 38.0,
        "allow_high_risk": True,
        "high_risk_min_score": 60.0,
        "high_risk_min_volume": 20,
    },
}


def normalise_text(value: str | None) -> str:
    return (value or "").strip().lower()


def categorise_item(
    name: str,
    item_class: str | None,
    item_subclass: str | None,
) -> str:
    name_key = normalise_text(name)
    class_key = normalise_text(item_class)
    subclass_key = normalise_text(item_subclass)

    combined = f"{name_key} {class_key} {subclass_key}"

    if class_key == "trade goods":
        return "Crafting Materials"

    if class_key == "consumable":
        return "Consumables"

    if class_key == "recipe":
        return "Recipes / Plans"

    if class_key == "battle pets":
        return "Battle Pets"

    if class_key == "glyph":
        return "Glyphs"

    if class_key == "gem":
        return "Gems"

    if class_key == "item enhancement":
        return "Enchants"

    if class_key in ["armor", "weapon"]:
        return "Gear / Transmog"

    if any(
        keyword in combined
        for keyword in [
            "flask",
            "phial",
            "potion",
            "elixir",
            "food",
            "feast",
            "rune",
            "vial",
            "cauldron",
        ]
    ):
        return "Consumables"

    if any(
        keyword in combined
        for keyword in [
            "herb",
            "ore",
            "cloth",
            "leather",
            "hide",
            "dust",
            "shard",
            "crystal",
            "essence",
            "alloy",
            "thread",
            "scale",
            "ink",
        ]
    ):
        return "Crafting Materials"

    if any(
        keyword in combined
        for keyword in [
            "enchant",
            "missive",
            "armor kit",
            "weapon oil",
            "mana oil",
            "writ",
        ]
    ):
        return "Enchants"

    if any(
        keyword in combined
        for keyword in [
            "gem",
            "emerald",
            "ruby",
            "sapphire",
            "diamond",
            "onyx",
            "malachite",
        ]
    ):
        return "Gems"

    if any(
        keyword in combined
        for keyword in [
            "recipe",
            "pattern",
            "plans",
            "schematic",
            "formula",
            "design",
            "technique",
        ]
    ):
        return "Recipes / Plans"

    if any(
        keyword in combined
        for keyword in [
            "mount",
            "toy",
            "illusion",
            "pet",
            "manuscript",
            "appearance",
            "cosmetic",
        ]
    ):
        return "Rare / Collector Items"

    return "Unknown / Other"


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
            "item_class": None,
            "item_subclass": None,
        }


def calculate_opportunity_score(
    price: float,
    volume: int,
    listing_count: int,
    quality: str | None,
    goldsmith_category: str,
) -> float:
    quality_key = (quality or "unknown").lower()

    category_bonus = CATEGORY_SCORE_BONUS.get(goldsmith_category, 0)

    if goldsmith_category in FAST_MOVE_CATEGORIES:
        value_score = min(price / 75000, 1) * 22
        volume_score = min(volume / 80, 1) * 43
        listing_score = min(listing_count / 30, 1) * 25
    elif goldsmith_category in SLOW_MOVE_CATEGORIES:
        value_score = min(price / 175000, 1) * 42
        volume_score = min(volume / 12, 1) * 18
        listing_score = min(listing_count / 8, 1) * 18
    else:
        value_score = min(price / 100000, 1) * 30
        volume_score = min(volume / 50, 1) * 35
        listing_score = min(listing_count / 20, 1) * 25

    rarity_score = QUALITY_SCORE.get(quality_key, 3)

    score = value_score + volume_score + listing_score + rarity_score + category_bonus

    if goldsmith_category in FAST_MOVE_CATEGORIES:
        if volume < 10:
            score -= 18
        elif volume < 20:
            score -= 8

        if listing_count <= 3:
            score -= 8

    elif goldsmith_category in SLOW_MOVE_CATEGORIES:
        if price < 100:
            score -= 15

        if volume <= 0:
            score -= 15

    else:
        if volume < 10:
            score -= 18
        elif volume < 20:
            score -= 10

        if listing_count <= 3:
            score -= 10
        elif listing_count <= 6:
            score -= 5

    if price > 150000 and volume < 20 and goldsmith_category not in SLOW_MOVE_CATEGORIES:
        score -= 10

    if price < 25 and goldsmith_category not in SLOW_MOVE_CATEGORIES:
        score -= 8

    return round(max(1, min(score, 100)), 1)


def calculate_risk_level(
    price: float,
    volume: int,
    listing_count: int,
    opportunity_score: float,
    goldsmith_category: str,
) -> str:
    if goldsmith_category in FAST_MOVE_CATEGORIES:
        if volume < 10 or listing_count <= 3:
            return "High"

        if opportunity_score >= 75 and volume >= 35 and listing_count >= 10:
            return "Low"

        if opportunity_score >= 50 and volume >= 12 and listing_count >= 5:
            return "Medium"

        return "High"

    if goldsmith_category in SLOW_MOVE_CATEGORIES:
        if price < 100:
            return "High"

        if opportunity_score >= 80 and listing_count >= 1:
            return "Medium"

        if opportunity_score >= 68 and price >= 1000:
            return "Medium"

        return "High"

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
    scan_mode: str,
    goldsmith_category: str,
) -> str:
    quality_label = (quality or "unknown").capitalize()

    if goldsmith_category in FAST_MOVE_CATEGORIES:
        category_note = "fast-moving market type"
    elif goldsmith_category in SLOW_MOVE_CATEGORIES:
        category_note = "slower market type with higher margin potential"
    else:
        category_note = "general market type"

    if risk_level == "Low":
        return (
            f"Strong {scan_mode} scan opportunity: {quality_label} "
            f"{goldsmith_category} item with {volume} quantity across "
            f"{listing_count} listings, score {opportunity_score}/100 and "
            f"{category_note}."
        )

    if risk_level == "Medium":
        return (
            f"Moderate {scan_mode} scan opportunity: {quality_label} "
            f"{goldsmith_category} item with {volume} quantity across "
            f"{listing_count} listings. Review market depth before buying."
        )

    return (
        f"Higher-risk {scan_mode} scan candidate: {goldsmith_category} item "
        f"with {volume} quantity across {listing_count} listings. Check "
        f"sell-through and avoid overbuying."
    )


def passes_final_profitability_buffers(
    opportunity: dict,
    scan_config: dict,
) -> bool:
    score = opportunity["opportunity_score"]
    risk_level = opportunity["risk_level"]
    volume = opportunity["volume"]
    listing_count = opportunity["listing_count"]
    price = opportunity["price"]
    category = opportunity["goldsmith_category"]

    if price < scan_config["min_price"] and category not in SLOW_MOVE_CATEGORIES:
        return False

    if price > scan_config["max_price"]:
        return False

    if category in FAST_MOVE_CATEGORIES:
        if volume < scan_config["min_volume"]:
            return False

        if listing_count < scan_config["min_listing_count"]:
            return False

    elif category in SLOW_MOVE_CATEGORIES:
        if price < 100:
            return False

        if listing_count < 1:
            return False

        if score < scan_config["min_final_score"] + 8:
            return False

    else:
        if volume < scan_config["min_volume"]:
            return False

        if listing_count < scan_config["min_listing_count"]:
            return False

    if score < scan_config["min_final_score"]:
        return False

    if risk_level == "High" and not scan_config["allow_high_risk"]:
        return False

    if risk_level == "High":
        if category in SLOW_MOVE_CATEGORIES and score >= 72 and price >= 1000:
            return True

        if score < scan_config["high_risk_min_score"]:
            return False

        if volume < scan_config["high_risk_min_volume"]:
            return False

    return True


def build_market_capture_rows(
    item_stats: dict[int, dict[str, float | int]],
    connected_realm_id: int,
    realm_name: str,
    scan_mode: str,
    scan_config: dict,
) -> list[MarketSnapshot]:
    capture_candidates = []

    for item_id, stats in item_stats.items():
        min_price = float(stats["min_price"])
        total_market_value = float(stats["total_market_value"])
        volume = int(stats["volume"])
        listing_count = int(stats["listing_count"])

        if min_price < scan_config["capture_min_price"]:
            continue

        if min_price > scan_config["capture_max_price"]:
            continue

        if volume < scan_config["capture_min_volume"]:
            continue

        if listing_count < scan_config["capture_min_listing_count"]:
            continue

        average_price = total_market_value / volume if volume > 0 else min_price

        capture_candidates.append(
            {
                "item_id": item_id,
                "min_price": round(min_price, 2),
                "average_price": round(average_price, 2),
                "total_market_value": round(total_market_value, 2),
                "volume": volume,
                "listing_count": listing_count,
            }
        )

    capture_candidates.sort(
        key=lambda item: (
            item["total_market_value"],
            item["volume"],
            item["listing_count"],
            item["min_price"],
        ),
        reverse=True,
    )

    capture_candidates = capture_candidates[: scan_config["capture_limit"]]

    return [
        MarketSnapshot(
            item_id=item["item_id"],
            realm_id=connected_realm_id,
            realm_name=realm_name,
            scan_mode=scan_mode,
            min_price=item["min_price"],
            average_price=item["average_price"],
            total_market_value=item["total_market_value"],
            volume=item["volume"],
            listing_count=item["listing_count"],
        )
        for item in capture_candidates
    ]


async def enrich_candidate(
    candidate: dict,
    semaphore: asyncio.Semaphore,
    scan_mode: str,
) -> dict:
    async with semaphore:
        item_id = candidate["item_id"]

        display_data = await get_display_data_safely(item_id)

        item_name = display_data["name"]
        item_class = display_data.get("item_class")
        item_subclass = display_data.get("item_subclass")

        goldsmith_category = categorise_item(
            name=item_name,
            item_class=item_class,
            item_subclass=item_subclass,
        )

        opportunity_score = calculate_opportunity_score(
            price=candidate["price"],
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            quality=display_data["quality"],
            goldsmith_category=goldsmith_category,
        )

        risk_level = calculate_risk_level(
            price=candidate["price"],
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            opportunity_score=opportunity_score,
            goldsmith_category=goldsmith_category,
        )

        reason = build_reason(
            volume=candidate["volume"],
            listing_count=candidate["listing_count"],
            quality=display_data["quality"],
            opportunity_score=opportunity_score,
            risk_level=risk_level,
            scan_mode=scan_mode,
            goldsmith_category=goldsmith_category,
        )

        return {
            "item_id": item_id,
            "name": item_name,
            "price": candidate["price"],
            "volume": candidate["volume"],
            "listing_count": candidate["listing_count"],
            "icon_url": display_data["icon_url"],
            "quality": display_data["quality"],
            "item_class": item_class,
            "item_subclass": item_subclass,
            "goldsmith_category": goldsmith_category,
            "opportunity_score": opportunity_score,
            "risk_level": risk_level,
            "reason": reason,
        }


def build_category_breakdown(items: list[dict]) -> dict:
    breakdown: dict[str, int] = {}

    for item in items:
        category = item.get("goldsmith_category") or "Unknown / Other"
        breakdown[category] = breakdown.get(category, 0) + 1

    return dict(sorted(breakdown.items()))


@router.post("/sync-auctions")
async def sync_auctions(
    connected_realm_id: int = Query(default=11),
    scan_mode: str = Query(default="quick"),
    db: AsyncSession = Depends(get_db),
):
    try:
        scan_mode = scan_mode.lower().strip()

        if scan_mode not in SCAN_CONFIGS:
            return {
                "status": "Sync Failed",
                "error": "Invalid scan_mode. Use 'quick' or 'full'.",
            }

        scan_config = SCAN_CONFIGS[scan_mode]

        realm_name = await get_realm_display_name(connected_realm_id)

        print(
            f"[SYNC] Starting {scan_mode} auction sync for "
            f"connected_realm_id={connected_realm_id}"
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
            quantity = int(auction.get("quantity", 1))

            if price_gold < scan_config["capture_min_price"]:
                continue

            if price_gold > scan_config["capture_max_price"]:
                continue

            listing_market_value = price_gold * quantity

            if item_id not in item_stats:
                item_stats[item_id] = {
                    "min_price": price_gold,
                    "volume": 0,
                    "listing_count": 0,
                    "total_market_value": 0.0,
                }

            item_stats[item_id]["min_price"] = min(
                float(item_stats[item_id]["min_price"]),
                price_gold,
            )

            item_stats[item_id]["volume"] = int(
                item_stats[item_id]["volume"]
            ) + quantity

            item_stats[item_id]["listing_count"] = (
                int(item_stats[item_id]["listing_count"]) + 1
            )

            item_stats[item_id]["total_market_value"] = (
                float(item_stats[item_id]["total_market_value"])
                + listing_market_value
            )

        market_snapshots = build_market_capture_rows(
            item_stats=item_stats,
            connected_realm_id=connected_realm_id,
            realm_name=realm_name,
            scan_mode=scan_mode,
            scan_config=scan_config,
        )

        candidates = []

        for item_id, stats in item_stats.items():
            price = float(stats["min_price"])
            volume = int(stats["volume"])
            listing_count = int(stats["listing_count"])

            if price < scan_config["min_price"]:
                continue

            if price > scan_config["max_price"]:
                continue

            if volume < scan_config["min_volume"] and scan_mode == "quick":
                continue

            if listing_count < scan_config["min_listing_count"] and scan_mode == "quick":
                continue

            preliminary_score = (
                min(price / 100000, 1) * 35
                + min(volume / 60, 1) * 40
                + min(listing_count / 25, 1) * 25
            )

            preliminary_score = round(preliminary_score, 1)

            if preliminary_score < scan_config["min_preliminary_score"]:
                continue

            candidates.append(
                {
                    "item_id": item_id,
                    "price": round(price, 2),
                    "volume": volume,
                    "listing_count": listing_count,
                    "preliminary_score": preliminary_score,
                }
            )

        candidates.sort(
            key=lambda item: (
                item["preliminary_score"],
                item["volume"],
                item["listing_count"],
                item["price"],
            ),
            reverse=True,
        )

        metadata_pool = candidates[: scan_config["metadata_limit"]]

        print(
            f"[SYNC] Capturing market rows={len(market_snapshots)}. "
            f"Candidates found={len(candidates)}. "
            f"Fetching metadata for top {len(metadata_pool)} items..."
        )

        semaphore = asyncio.Semaphore(10)

        enriched_candidates = await asyncio.gather(
            *[
                enrich_candidate(
                    candidate=candidate,
                    semaphore=semaphore,
                    scan_mode=scan_mode,
                )
                for candidate in metadata_pool
            ]
        )

        buffered_candidates = [
            opportunity
            for opportunity in enriched_candidates
            if passes_final_profitability_buffers(
                opportunity=opportunity,
                scan_config=scan_config,
            )
        ]

        buffered_candidates.sort(
            key=lambda item: (
                item["opportunity_score"],
                item["volume"],
                item["listing_count"],
                item["price"],
            ),
            reverse=True,
        )

        top_opportunities = buffered_candidates[: scan_config["save_limit"]]

        await db.execute(
            delete(TrackedItem).where(
                TrackedItem.realm_id == connected_realm_id
            )
        )

        await db.flush()

        for market_snapshot in market_snapshots:
            db.add(market_snapshot)

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
                item_class=opportunity["item_class"],
                item_subclass=opportunity["item_subclass"],
                goldsmith_category=opportunity["goldsmith_category"],
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
                item_class=opportunity["item_class"],
                item_subclass=opportunity["item_subclass"],
                goldsmith_category=opportunity["goldsmith_category"],
                profit_margin=opportunity["opportunity_score"],
            )

            db.add(tracked_item)
            db.add(price_snapshot)

        await db.commit()

        category_breakdown = build_category_breakdown(top_opportunities)

        print(
            f"[SYNC] Completed {scan_mode} scan. "
            f"Auctions={len(auctions)}, "
            f"items_scanned={len(item_stats)}, "
            f"market_snapshots={len(market_snapshots)}, "
            f"candidates={len(candidates)}, "
            f"metadata_enriched={len(enriched_candidates)}, "
            f"buffered={len(buffered_candidates)}, "
            f"opportunities={len(top_opportunities)}"
        )

        return {
            "status": "Success",
            "scan_mode": scan_mode,
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "auctions_downloaded": len(auctions),
            "items_scanned": len(item_stats),
            "market_snapshots_saved": len(market_snapshots),
            "candidates_found": len(candidates),
            "metadata_enriched": len(enriched_candidates),
            "passed_profitability_buffers": len(buffered_candidates),
            "opportunities_unlocked": len(top_opportunities),
            "snapshots_saved": len(top_opportunities),
            "category_breakdown": category_breakdown,
            "buffers": {
                "capture_min_price": scan_config["capture_min_price"],
                "capture_max_price": scan_config["capture_max_price"],
                "capture_min_volume": scan_config["capture_min_volume"],
                "capture_min_listing_count": scan_config[
                    "capture_min_listing_count"
                ],
                "min_price": scan_config["min_price"],
                "max_price": scan_config["max_price"],
                "min_volume": scan_config["min_volume"],
                "min_listing_count": scan_config["min_listing_count"],
                "min_final_score": scan_config["min_final_score"],
            },
        }

    except Exception as error:
        await db.rollback()

        print(f"[SYNC ERROR] {str(error)}")

        return {
            "status": "Sync Failed",
            "scan_mode": scan_mode,
            "error": str(error),
        }