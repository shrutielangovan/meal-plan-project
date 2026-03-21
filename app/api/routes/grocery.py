from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.grocery import GroceryList, GroceryItem
from app.models.meal_plan import MealPlanSlot
from app.models.user import PantryItem
from app.schemas.grocery import GroceryListResponse, GroceryItemUpdate, GroceryItemResponse
from typing import List, Optional
from uuid import UUID
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan
from app.models.user import PantryItem

router = APIRouter()


@router.post("/{user_id}/generate/{plan_id}", response_model=GroceryListResponse)
def generate_grocery_list(user_id: UUID, plan_id: UUID, db: Session = Depends(get_db)):
    
    plan = db.query(MealPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    if plan.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot generate grocery list for a {plan.status} plan — only active plans are allowed")

    existing = db.query(GroceryList).filter_by(
        user_id=user_id,
        meal_plan_id=plan_id
    ).first()
    if existing:
        return existing
    existing = db.query(GroceryList).filter_by(
        user_id=user_id,
        meal_plan_id=plan_id
    ).first()
    if existing:
        return existing

    slots = db.query(MealPlanSlot).options(
        joinedload(MealPlanSlot.recipe).joinedload(Recipe.ingredients)
    ).filter_by(meal_plan_id=plan_id).all()

    if not slots:
        raise HTTPException(status_code=404, detail="No slots found for this meal plan")

    filled_slots = [s for s in slots if s.recipe_id is not None and s.recipe is not None]
    if not filled_slots:
        raise HTTPException(status_code=400, detail="No recipes assigned to this plan yet — assign recipes to slots before generating a grocery list")

    pantry = db.query(PantryItem).filter_by(user_id=user_id).all()
    pantry_map = {
        item.ingredient_name.lower().strip(): item.quantity
        for item in pantry
    }

    ingredient_map = {}
    for slot in filled_slots:
        recipe = slot.recipe
        servings_ratio = (slot.servings_override or recipe.servings) / recipe.servings
        for ing in recipe.ingredients:
            key = ing.ingredient_name.lower().strip()
            if key in ingredient_map:
                ingredient_map[key]["quantity"] += (ing.quantity or 0) * servings_ratio
            else:
                ingredient_map[key] = {
                    "ingredient_name": key,
                    "quantity": round((ing.quantity or 0) * servings_ratio, 2),
                    "unit": ing.unit,
                    "category": None,
                    "is_checked": False,
                    "in_pantry": key in pantry_map,
                }

    grocery_list = GroceryList(user_id=user_id, meal_plan_id=plan_id)
    db.add(grocery_list)
    db.flush()

    for data in ingredient_map.values():
        item = GroceryItem(grocery_list_id=grocery_list.id, **data)
        db.add(item)

    db.commit()
    db.refresh(grocery_list)
    return grocery_list


@router.get("/{user_id}", response_model=List[GroceryListResponse])
def get_grocery_lists(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(GroceryList).options(
        joinedload(GroceryList.items)
    ).filter_by(user_id=user_id).order_by(GroceryList.created_at.desc()).all()


@router.get("/{user_id}/{list_id}", response_model=GroceryListResponse)
def get_grocery_list(user_id: UUID, list_id: UUID, db: Session = Depends(get_db)):
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items)
    ).filter_by(id=list_id, user_id=user_id).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    return grocery_list


@router.patch("/{user_id}/{list_id}/items/{item_id}", response_model=GroceryItemResponse)
def update_grocery_item(
    user_id: UUID,
    list_id: UUID,
    item_id: UUID,
    item_in: GroceryItemUpdate,
    db: Session = Depends(get_db)
):
    grocery_list = db.query(GroceryList).filter_by(
        id=list_id, user_id=user_id
    ).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    item = db.query(GroceryItem).filter_by(
        id=item_id, grocery_list_id=list_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    was_checked = item.is_checked

    for field, value in item_in.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    if not was_checked and item.is_checked:
        quantity_to_add = item.quantity if item.quantity and item.quantity > 0 else None

        existing_pantry = db.query(PantryItem).filter_by(
            user_id=user_id,
            ingredient_name=item.ingredient_name.lower().strip()
        ).first()

        if existing_pantry:
            if quantity_to_add:
                existing_pantry.quantity = (existing_pantry.quantity or 0) + quantity_to_add
        else:
            new_pantry_item = PantryItem(
                user_id=user_id,
                ingredient_name=item.ingredient_name.lower().strip(),
                quantity=quantity_to_add,
                unit=item.unit,
            )
            db.add(new_pantry_item)

    db.commit()
    db.refresh(item)
    return item



@router.delete("/{user_id}/{list_id}")
def delete_grocery_list(user_id: UUID, list_id: UUID, db: Session = Depends(get_db)):
    grocery_list = db.query(GroceryList).filter_by(
        id=list_id, user_id=user_id
    ).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    db.delete(grocery_list)
    db.commit()
    return {"message": "Grocery list deleted"}