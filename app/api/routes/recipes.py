from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, Text
from app.database import get_db
from app.models.recipe import Recipe
from app.schemas.recipe import RecipeResponse
from typing import Optional, List
from uuid import UUID
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY


router = APIRouter()

@router.get("/", response_model=List[RecipeResponse])
def search_recipes(
    query: Optional[str] = Query(None),
    meal_type: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    max_prep_time: Optional[int] = Query(None),
    limit: int = Query(500),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    q = db.query(Recipe).options(joinedload(Recipe.ingredients))

    if query:
        q = q.filter(Recipe.title.ilike(f"%{query}%"))
    if meal_type:
        q = q.filter(Recipe.meal_type == meal_type)
    if tag:
        q = q.filter(Recipe.tags.op("@>")(cast([tag], PG_ARRAY(Text))))
    if max_prep_time:
        q = q.filter(Recipe.prep_time_mins <= max_prep_time)

    return q.offset(offset).limit(limit).all()

@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: UUID, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).options(
        joinedload(Recipe.ingredients)
    ).filter_by(id=recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@router.get("/meal-type/{meal_type}", response_model=List[RecipeResponse])
def get_by_meal_type(
    meal_type: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    valid = ["breakfast", "lunch", "dinner", "snack"]
    if meal_type not in valid:
        raise HTTPException(status_code=400, detail=f"meal_type must be one of {valid}")
    recipes = db.query(Recipe).options(
        joinedload(Recipe.ingredients)
    ).filter_by(meal_type=meal_type).offset(offset).limit(limit).all()
    return recipes