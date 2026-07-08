from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func
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

    # Legacy compatibility field.
    # Older frontend/backend code expected profit_margin.
    # We now store the opportunity_score here as well so nothing breaks.
    profit_margin = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())