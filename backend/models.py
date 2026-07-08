from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, index=True)               # The WoW Item ID
    realm_id = Column(Integer, default=11, index=True)  # The Connected Realm ID
    name = Column(String, index=True)
    current_price = Column(Float, default=0.0)          # Lowest active buyout price
    market_volume = Column(Integer, default=0)          # Number of active auction listings
    profit_margin = Column(Float, default=0.0)          # Arbitrage value marker

    __table_args__ = (UniqueConstraint('item_id', 'realm_id', name='_item_realm_uc'),)