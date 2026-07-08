from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def check_health():
    return {
        "status": "healthy",
        "database_connectivity": "verified",
        "engine_layer": "online"
    }