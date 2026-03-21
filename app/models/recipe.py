import uuid
from sqlalchemy import Column, String, Integer, Float, Text, TIMESTAMP, ARRAY, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spoonacular_id = Column(Integer, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    meal_type = Column(String(50), nullable=False)
    prep_time_mins = Column(Integer, nullable=True)
    servings = Column(Integer, default=1)
    calories = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)
    instructions = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), default=[])
    created_at = Column(TIMESTAMP, server_default=func.now())

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete")
    meal_plan_slots = relationship("MealPlanSlot", back_populates="recipe")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    ingredient_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)

    recipe = relationship("Recipe", back_populates="ingredients")