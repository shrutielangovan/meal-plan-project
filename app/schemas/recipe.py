from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class RecipeIngredientResponse(BaseModel):
    id: UUID
    ingredient_name: str
    quantity: Optional[float]
    unit: Optional[str]

    class Config:
        from_attributes = True

class RecipeResponse(BaseModel):
    id: UUID
    spoonacular_id: int
    title: str
    meal_type: str
    prep_time_mins: Optional[int]
    servings: int
    calories: Optional[float]
    protein_g: Optional[float]
    carbs_g: Optional[float]
    fat_g: Optional[float]
    fiber_g: Optional[float]
    instructions: Optional[str]
    image_url: Optional[str]
    tags: List[str]
    ingredients: List[RecipeIngredientResponse] = []

    class Config:
        from_attributes = True

class RecipeSearchParams(BaseModel):
    query: Optional[str] = None
    meal_type: Optional[str] = None
    tags: Optional[List[str]] = None
    max_prep_time: Optional[int] = None
    limit: int = 20
    offset: int = 0