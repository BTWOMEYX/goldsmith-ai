from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class TrackedItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, index=True)               # The WoW Item ID
    realm_id = Column(Integer, default=11, index=True)  # Added to isolate market calculations
    name = Column(String, index=True)
    current_price = Column(Float, default=0.0)          # Buyout price in Gold
    profit_margin = Column(Float, default=0.0)          # Margin percentage

    # Enforce unique tracking constraints per item/realm combo
    __table_args__ = (UniqueConstraint('item_id', 'realm_id', name='_item_realm_uc'),)

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, unique=True, index=True) 
    name = Column(String, index=True)
    crafted_item_id = Column(Integer)
    yield_quantity = Column(Integer, default=1)          

    ingredients = relationship("RecipeIngredient", back_populates="recipe", lazy="selectin")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.recipe_id"))
    item_id = Column(Integer)
    quantity = Column(Integer, default=1)                

    recipe = relationship("Recipe", back_populates="ingredients")