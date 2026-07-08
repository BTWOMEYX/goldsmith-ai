from sqlalchemy import Column, DateTime, Float, Integer, String, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)

    name = Column(String, nullable=False)
    current_price = Column(Float, nullable=False)
    profit_margin = Column(Float, nullable=False)

    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())