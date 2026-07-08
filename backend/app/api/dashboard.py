from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.utils.realms import BLIZZARD_REALM_MATRIX
from database import get_db
from models import TrackedItem

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/realms")
async def get_supported_realms():
    """
    Returns an alphabetically structured list of servers matching frontend drop-down requirements.
    """
    server_list = [
        {"id": realm_id, "name": realm_name} 
        for realm_id, realm_name in BLIZZARD_REALM_MATRIX.items()
    ]
    # Sort alphabetically by display name string
    server_list.sort(key=lambda x: x["name"])
    return server_list


@router.get("/dashboard")
async def get_dashboard_data(
    connected_realm_id: int = Query(default=3683),  # Match sync identifier
    db: AsyncSession = Depends(get_db)
):
    try:
        realm_target = connected_realm_id if connected_realm_id in BLIZZARD_REALM_MATRIX else 363
        
        result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == realm_target)
            .order_by(TrackedItem.profit_margin.desc())
        )
        items = result.scalars().all()
        
        return {
            "status": "Success",
            "realm": BLIZZARD_REALM_MATRIX.get(realm_target, "Illidan"),
            "items": [
                {
                    "id": i.id,
                    "item_id": i.item_id,
                    "name": i.name,
                    "current_price": i.current_price,
                    "profit_margin": i.profit_margin
                } for i in items
            ]
        }
    except Exception as e:
        return {"status": "Error", "error": str(e)}