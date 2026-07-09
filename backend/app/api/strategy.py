from fastapi import APIRouter
from pydantic import BaseModel

from app.services.strategy_profiles import (
    get_active_strategy_profile,
    get_available_strategy_profiles,
    set_active_strategy_profile,
)

router = APIRouter(
    prefix="/api",
    tags=["Strategy Profiles"],
)


class StrategySettingsPayload(BaseModel):
    profile_id: str


@router.get("/strategy/status")
async def get_strategy_status():
    active_profile = get_active_strategy_profile()

    return {
        "status": "Success",
        "active_profile": active_profile,
        "profiles": get_available_strategy_profiles(),
    }


@router.post("/strategy/settings")
async def update_strategy_settings(payload: StrategySettingsPayload):
    try:
        active_profile = set_active_strategy_profile(payload.profile_id)

        return {
            "status": "Success",
            "active_profile": active_profile,
            "profiles": get_available_strategy_profiles(),
        }

    except ValueError as error:
        return {
            "status": "Error",
            "error": str(error),
            "active_profile": get_active_strategy_profile(),
            "profiles": get_available_strategy_profiles(),
        }
