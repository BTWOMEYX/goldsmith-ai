LOCAL_ITEM_REGISTRY = {
    240161: "Null Lotus",
    128313: "Furious Potion",
    219931: "Bismuth Ore (Tier 3)",
    219933: "Ironclaw Ore (Tier 3)",
    225369: "Gilded Alloy",
    15065: "Ancient Leather",
    219932: "Aqirite Ore (Tier 3)",
    245772: "Arkhana Crystallite",
    225449: "Sample Premium Alloy",
    173202: "Shadowghast Ingot",
    173204: "Elethium Ore",
}


def resolve_item_name(item_id: int) -> str:
    if item_id in LOCAL_ITEM_REGISTRY:
        return LOCAL_ITEM_REGISTRY[item_id]

    if 217000 <= item_id <= 217999:
        return f"Algari Competitor Asset {item_id}"

    if item_id > 210000:
        return f"Khaz Algar Trade Gear {item_id}"

    return f"Premium Speculative Asset {item_id}"