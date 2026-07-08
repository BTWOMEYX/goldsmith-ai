from fastapi import APIRouter

from app.services.blizzard import blizzard_service

router = APIRouter(
    prefix="/api",
    tags=["Realms"],
)


@router.get("/realms")
async def get_realms():
    try:
        realms = await blizzard_service.get_connected_realms_summary()

        return {
            "status": "Success",
            "region": blizzard_service.region.upper(),
            "connected_realm_count": len(realms),
            "items": realms,
        }

    except Exception as error:
        return {
            "status": "Error",
            "error": str(error),
            "items": [],
        }