from app.services.blizzard import blizzard_service


class AuctionService:

    @staticmethod
    async def download(realm_id: int):

        return await blizzard_service.get_auction_house_data(
            connected_realm_id=realm_id
        )