import uuid
from sqlalchemy import Column, String, Float, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class GroceryList(Base):
    __tablename__ = "grocery_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_plan_id = Column(UUID(as_uuid=True), ForeignKey("meal_plans.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="grocery_lists")
    meal_plan = relationship("MealPlan", back_populates="grocery_list")
    items = relationship("GroceryItem", back_populates="grocery_list", cascade="all, delete")


class GroceryItem(Base):
    __tablename__ = "grocery_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grocery_list_id = Column(UUID(as_uuid=True), ForeignKey("grocery_lists.id", ondelete="CASCADE"), nullable=False)
    ingredient_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    category = Column(String(100), nullable=True)
    is_checked = Column(Boolean, default=False)
    in_pantry = Column(Boolean, default=False)

    grocery_list = relationship("GroceryList", back_populates="items")