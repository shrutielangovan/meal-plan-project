import uuid
from sqlalchemy import Column, String, Integer, Float, Text, TIMESTAMP, DATE, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start = Column(DATE, nullable=False)
    plan_type = Column(String(50), nullable=False)
    status = Column(String(50), default="active")
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="meal_plans")
    slots = relationship("MealPlanSlot", back_populates="meal_plan", cascade="all, delete")
    grocery_list = relationship("GroceryList", back_populates="meal_plan", uselist=False)


class MealPlanSlot(Base):
    __tablename__ = "meal_plan_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_plan_id = Column(UUID(as_uuid=True), ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("recipes.id"), nullable=True)
    day_of_week = Column(Integer, nullable=False)
    meal_slot = Column(String(50), nullable=False)
    servings_override = Column(Integer, nullable=True)

    meal_plan = relationship("MealPlan", back_populates="slots")
    recipe = relationship("Recipe", back_populates="meal_plan_slots")


class LoggedMeal(Base):
    __tablename__ = "logged_meals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=True)
    description = Column(Text, nullable=False)
    meal_slot = Column(String(50), nullable=True)
    logged_at = Column(TIMESTAMP, server_default=func.now())
    calories = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    source = Column(String(50), default="estimated")

    user = relationship("User", back_populates="logged_meals")
    session = relationship("ChatSession", back_populates="logged_meals")