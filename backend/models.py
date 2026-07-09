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



class BuyQueueItem(Base):
    __tablename__ = "buy_queue_items"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    decision_grade = Column(String, nullable=True)
    final_decision = Column(String, nullable=True)
    decision_score = Column(Float, nullable=False, default=0)
    buy_pressure = Column(String, nullable=True)
    position_size_label = Column(String, nullable=True)

    signal = Column(String, nullable=True)
    memory_price_state = Column(String, nullable=True)

    suggested_quantity = Column(Integer, nullable=False, default=1)
    max_price_each = Column(Float, nullable=False, default=0)
    max_total_spend = Column(Float, nullable=False, default=0)

    target_sale_price_each = Column(Float, nullable=False, default=0)
    expected_profit_each = Column(Float, nullable=False, default=0)
    expected_total_profit = Column(Float, nullable=False, default=0)
    expected_margin_percent = Column(Float, nullable=False, default=0)

    status = Column(String, index=True, nullable=False, default="queued")

    bought_quantity = Column(Integer, nullable=False, default=0)
    bought_price_each = Column(Float, nullable=False, default=0)
    total_buy_cost = Column(Float, nullable=False, default=0)

    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    bought_at = Column(DateTime(timezone=True), nullable=True)



class TradeEntry(Base):
    __tablename__ = "trade_entries"

    id = Column(Integer, primary_key=True, index=True)

    buy_queue_item_id = Column(Integer, index=True, nullable=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    quantity_bought = Column(Integer, nullable=False, default=1)
    buy_price_each = Column(Float, nullable=False, default=0)
    total_buy_cost = Column(Float, nullable=False, default=0)

    target_sale_price_each = Column(Float, nullable=False, default=0)
    expected_total_sale_value = Column(Float, nullable=False, default=0)
    expected_profit = Column(Float, nullable=False, default=0)
    expected_roi_percent = Column(Float, nullable=False, default=0)

    quantity_sold = Column(Integer, nullable=False, default=0)
    actual_sale_price_each = Column(Float, nullable=False, default=0)
    gross_sale_value = Column(Float, nullable=False, default=0)
    sale_fee_percent = Column(Float, nullable=False, default=5)
    sale_fee_value = Column(Float, nullable=False, default=0)
    net_sale_value = Column(Float, nullable=False, default=0)

    realized_profit = Column(Float, nullable=False, default=0)
    roi_percent = Column(Float, nullable=False, default=0)

    status = Column(String, index=True, nullable=False, default="open")

    decision_grade = Column(String, nullable=True)
    final_decision = Column(String, nullable=True)
    decision_score = Column(Float, nullable=False, default=0)

    signal = Column(String, nullable=True)
    memory_price_state = Column(String, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    sold_at = Column(DateTime(timezone=True), nullable=True)


class PlanItemAction(Base):
    __tablename__ = "plan_item_actions"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    item_name = Column(String, nullable=True)

    action_type = Column(String, index=True, nullable=False)
    reason = Column(Text, nullable=True)

    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
