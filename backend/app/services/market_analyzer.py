from app.services.item_resolver import resolve_item_name


class MarketAnalyzer:

    @staticmethod
    def analyse(item_prices, item_volumes):

        opportunities = []

        for item_id, price in item_prices.items():

            volume = item_volumes.get(item_id, 1)

            if volume > 5:

                opportunities.append(
                    {
                        "item_id": item_id,
                        "name": resolve_item_name(item_id),
                        "price": price,
                        "volume": volume,
                        "profit": round(price * 0.12, 2),
                    }
                )

        opportunities.sort(
            key=lambda x: x["profit"],
            reverse=True,
        )

        return opportunities[:15]