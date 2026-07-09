from sqlalchemy import (
    Boolean,
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

    item_class = Column(String, nullable=True)
    item_subclass = Column(String, nullable=True)
    goldsmith_category = Column(
        String,
        nullable=False,
        default="Unknown / Other",
    )

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

    item_class = Column(String, nullable=True)
    item_subclass = Column(String, nullable=True)
    goldsmith_category = Column(
        String,
        nullable=False,
        default="Unknown / Other",
    )

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

    item_class = Column(String, nullable=True)
    item_subclass = Column(String, nullable=True)
    goldsmith_category = Column(
        String,
        nullable=False,
        default="Unknown / Other",
    )

    profit_margin = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    scan_mode = Column(String, nullable=False, default="quick")

    min_price = Column(Float, nullable=False, default=0)
    average_price = Column(Float, nullable=False, default=0)
    total_market_value = Column(Float, nullable=False, default=0)

    volume = Column(Integer, nullable=False, default=0)
    listing_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IgnoreRule(Base):
    __tablename__ = "ignore_rules"

    id = Column(Integer, primary_key=True, index=True)

    rule_type = Column(String, index=True, nullable=False)
    item_id = Column(Integer, index=True, nullable=True)
    realm_id = Column(Integer, index=True, nullable=True)

    item_name = Column(String, nullable=True)
    category = Column(String, index=True, nullable=True)
    keyword = Column(String, index=True, nullable=True)
    risk_level = Column(String, nullable=True)

    reason = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
