from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)

    name = Column(String, nullable=False)
    current_price = Column(Float, nullable=False)

    volume = Column(Integer, nullable=False, default=0)
    listing_count = Column(Integer, nullable=False, default=0)

    opportunity_score = Column(Float, nullable=False, default=0)
    risk_level = Column(String, nullable=False, default="Unknown")
    reason = Column(Text, nullable=True)

    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    profit_margin = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    name = Column(String, nullable=False)
    current_price = Column(Float, nullable=False)

    volume = Column(Integer, nullable=False, default=0)
    listing_count = Column(Integer, nullable=False, default=0)

    opportunity_score = Column(Float, nullable=False, default=0)
    risk_level = Column(String, nullable=False, default="Unknown")
    reason = Column(Text, nullable=True)

    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    profit_margin = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "item_id",
            "realm_id",
            name="uq_watchlist_item_realm",
        ),
    )


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    name = Column(String, nullable=False)
    current_price = Column(Float, nullable=False)

    volume = Column(Integer, nullable=False, default=0)
    listing_count = Column(Integer, nullable=False, default=0)

    opportunity_score = Column(Float, nullable=False, default=0)
    risk_level = Column(String, nullable=False, default="Unknown")
    reason = Column(Text, nullable=True)

    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    profit_margin = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())