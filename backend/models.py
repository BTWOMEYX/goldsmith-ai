from sqlalchemy import Column, Integer, String, Float
# Change this line to use the explicit root path
from database import Base 

class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, unique=True, index=True) # The actual WoW Item ID
    name = Column(String, index=True)
    current_price = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)