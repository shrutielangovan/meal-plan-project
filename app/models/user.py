import uuid
from sqlalchemy import Column, String, Integer, TIMESTAMP, ARRAY, Text, ForeignKey, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)
    household_size = Column(Integer, default=1)
    budget_weekly = Column(Integer, nullable=True)
    cooking_time_mins = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete")
    pantry_items = relationship("PantryItem", back_populates="user", cascade="all, delete")
    meal_plans = relationship("MealPlan", back_populates="user", cascade="all, delete")
    grocery_lists = relationship("GroceryList", back_populates="user", cascade="all, delete")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete")
    logged_meals = relationship("LoggedMeal", back_populates="user", cascade="all, delete")
    is_active = Column(Boolean, default=True, nullable=False)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dietary_restrictions = Column(ARRAY(Text), default=[])
    health_goals = Column(ARRAY(Text), default=[])
    ingredient_dislikes = Column(ARRAY(Text), default=[])
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="preferences")


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ingredient_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    expires_at = Column(TIMESTAMP, nullable=True)
    added_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="pantry_items")