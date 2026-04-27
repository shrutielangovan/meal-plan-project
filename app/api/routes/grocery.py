from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models.grocery import GroceryList, GroceryItem
from app.models.meal_plan import MealPlanSlot, LoggedMeal
from app.models.user import PantryItem, User
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan
from app.schemas.grocery import (
    GroceryListResponse, GroceryItemUpdate,
    GroceryItemResponse, GroceryItemCreate,
)
from app.models.user import UserPreferences
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from app.services.grocery_gemini_service import generate_grocery_suggestions

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────────

def get_or_create_standalone_list(user_id: UUID, db: Session) -> GroceryList:
    """
    Returns the most recent standalone grocery list (no meal_plan_id),
    or creates a new one if none exists.
    """
    grocery_list = (
        db.query(GroceryList)
        .filter(
            GroceryList.user_id == user_id,
            GroceryList.meal_plan_id == None,
        )
        .order_by(GroceryList.created_at.desc())
        .first()
    )
    if not grocery_list:
        grocery_list = GroceryList(user_id=user_id, meal_plan_id=None)
        db.add(grocery_list)
        db.flush()
    return grocery_list

# ── POST /generate-from-planned ───────────────────────────────────────────────

@router.post("/{user_id}/generate-from-planned", response_model=GroceryListResponse)
async def generate_from_planned(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Auto-generates a grocery list from:
    1. Planned LoggedMeal entries (status="planned") for today + future
    2. Checks pantry for missing ingredients
    3. Uses Gemini AI to fill in staples and additional suggestions
    4. Saves to a standalone GroceryList (no meal_plan_id)

    If a standalone list already exists for today, returns it without regenerating.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if we already generated a list today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = (
        db.query(GroceryList)
        .filter(
            GroceryList.user_id == user_id,
            GroceryList.meal_plan_id == None,
            GroceryList.created_at >= today_start,
        )
        .order_by(GroceryList.created_at.desc())
        .first()
    )
    if existing:
        # Return existing list with items loaded
        db.refresh(existing)
        return existing

    # Fetch planned meals (today + future)
    planned_meals = (
        db.query(LoggedMeal)
        .filter(
            LoggedMeal.user_id == user_id,
            LoggedMeal.status == "planned",
            LoggedMeal.logged_at >= today_start,
        )
        .all()
    )

    # Match planned meals to recipes and find missing ingredients
    pantry_items = db.query(PantryItem).filter_by(user_id=user_id).all()
    pantry_map = {p.ingredient_name.lower().strip(): p.quantity or 0 for p in pantry_items}
    pantry_names_str = ", ".join(pantry_map.keys()) or "nothing"

    missing_ingredients: list[dict] = []
    seen_ingredients: set[str] = set()

    for meal in planned_meals:
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal.description))
            .first()
        )
        if matching_recipe and hasattr(matching_recipe, "ingredients"):
            for ing in matching_recipe.ingredients:
                key = ing.ingredient_name.lower().strip()
                if key in seen_ingredients:
                    continue
                seen_ingredients.add(key)

                pantry_qty = pantry_map.get(key, 0)
                needed_qty = ing.quantity or 0

                if pantry_qty < needed_qty:
                    missing_ingredients.append({
                        "name": key,
                        "qty": round(needed_qty - pantry_qty, 2),
                        "unit": ing.unit or "",
                    })

    # Fetch user preferences for AI context

    prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
    dietary = prefs.dietary_restrictions if prefs and prefs.dietary_restrictions else []
    goals = prefs.health_goals if prefs and prefs.health_goals else []

    household_size = getattr(user, "household_size", 1) or 1
    budget = getattr(user, "budget_weekly", None)

    # Call Gemini for full grocery list
    try:
        ai_items = await generate_grocery_suggestions(
            household_size=household_size,
            budget=budget,
            dietary_restrictions=dietary,
            health_goals=goals,
            current_pantry=pantry_names_str,
            recent_purchases="",
            missing_recipe_ingredients=missing_ingredients,
        )
    except Exception as e:
        print(f"Gemini grocery generation failed: {e}")
        # Fall back to just the missing ingredients
        ai_items = [
            {
                "ingredient_name": i["name"],
                "category": "Other",
                "reason": "needed for planned recipe",
                "suggested_qty": i["qty"],
                "suggested_unit": i["unit"],
            }
            for i in missing_ingredients
        ]

    # Create the grocery list
    grocery_list = GroceryList(user_id=user_id, meal_plan_id=None)
    db.add(grocery_list)
    db.flush()

    # Add items — avoid duplicates
    added_names: set[str] = set()
    for ai_item in ai_items:
        name = ai_item.get("ingredient_name", "").lower().strip()
        if not name or name in added_names:
            continue
        if name in pantry_map:
            continue
        added_names.add(name)

        item = GroceryItem(
            grocery_list_id=grocery_list.id,
            ingredient_name=name,
            quantity=ai_item.get("suggested_qty"),
            unit=ai_item.get("suggested_unit"),
            category=ai_item.get("category"),
            is_checked=False,
            in_pantry=name in pantry_map,
        )
        db.add(item)

    db.commit()
    db.refresh(grocery_list)
    return grocery_list


# ── POST /{user_id}/{list_id}/items — manually add item ──────────────────────

@router.post("/{user_id}/{list_id}/items", response_model=GroceryItemResponse)
def add_grocery_item(
    user_id: UUID,
    list_id: UUID,
    item_in: GroceryItemCreate,
    db: Session = Depends(get_db),
):
    """Manually add an item (snack, drink, etc.) to an existing grocery list."""
    grocery_list = db.query(GroceryList).filter_by(id=list_id, user_id=user_id).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    # Check for duplicate
    existing = next(
        (i for i in grocery_list.items
            if i.ingredient_name.lower() == item_in.ingredient_name.lower().strip()),
        None
    )
    if existing:
        raise HTTPException(status_code=400, detail="Item already in list")

    pantry_item = db.query(PantryItem).filter_by(
        user_id=user_id,
        ingredient_name=item_in.ingredient_name.lower().strip()
    ).first()

    item = GroceryItem(
        grocery_list_id=list_id,
        ingredient_name=item_in.ingredient_name.lower().strip(),
        quantity=item_in.quantity,
        unit=item_in.unit,
        category=item_in.category or "Other",
        is_checked=False,
        in_pantry=pantry_item is not None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

# ── DELETE /{user_id}/{list_id}/items/{item_id} ───────────────────────────────

@router.delete("/{user_id}/{list_id}/items/{item_id}")
def delete_grocery_item(
    user_id: UUID,
    list_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
):
    """Remove an item from a grocery list."""
    grocery_list = db.query(GroceryList).filter_by(id=list_id, user_id=user_id).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    item = db.query(GroceryItem).filter_by(id=item_id, grocery_list_id=list_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item removed"}

# ── GET /{user_id} — list all grocery lists ───────────────────────────────────

@router.get("/{user_id}", response_model=List[GroceryListResponse])
def get_grocery_lists(user_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(GroceryList)
        .options(joinedload(GroceryList.items))
        .filter_by(user_id=user_id)
        .order_by(GroceryList.created_at.desc())
        .all()
    )

# ── GET /{user_id}/{list_id} ──────────────────────────────────────────────────

@router.get("/{user_id}/{list_id}", response_model=GroceryListResponse)
def get_grocery_list(user_id: UUID, list_id: UUID, db: Session = Depends(get_db)):
    grocery_list = (
        db.query(GroceryList)
        .options(joinedload(GroceryList.items))
        .filter_by(id=list_id, user_id=user_id)
        .first()
    )
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    return grocery_list

# ── PATCH /{user_id}/{list_id}/items/{item_id} — check/uncheck ───────────────

@router.patch("/{user_id}/{list_id}/items/{item_id}", response_model=GroceryItemResponse)
def update_grocery_item(
    user_id: UUID,
    list_id: UUID,
    item_id: UUID,
    item_in: GroceryItemUpdate,
    db: Session = Depends(get_db),
):
    grocery_list = db.query(GroceryList).filter_by(id=list_id, user_id=user_id).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    item = db.query(GroceryItem).filter_by(id=item_id, grocery_list_id=list_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    was_checked = item.is_checked

    for field, value in item_in.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    # Auto-add to pantry when checked
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
            db.add(PantryItem(
                user_id=user_id,
                ingredient_name=item.ingredient_name.lower().strip(),
                quantity=quantity_to_add,
                unit=item.unit,
            ))

    db.commit()
    db.refresh(item)
    return item

# ── DELETE /{user_id}/{list_id} — delete entire list ─────────────────────────

@router.delete("/{user_id}/{list_id}")
def delete_grocery_list(user_id: UUID, list_id: UUID, db: Session = Depends(get_db)):
    grocery_list = db.query(GroceryList).filter_by(id=list_id, user_id=user_id).first()
    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    db.delete(grocery_list)
    db.commit()
    return {"message": "Grocery list deleted"}

# ── POST /{user_id}/generate/{plan_id} — keep existing endpoint ──────────────

@router.post("/{user_id}/generate/{plan_id}", response_model=GroceryListResponse)
def generate_grocery_list(user_id: UUID, plan_id: UUID, db: Session = Depends(get_db)):
    """Existing endpoint — generates from a formal MealPlan record. Kept for compatibility."""
    plan = db.query(MealPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    if plan.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot generate grocery list for a {plan.status} plan")

    existing = db.query(GroceryList).filter_by(user_id=user_id, meal_plan_id=plan_id).first()
    if existing:
        return existing

    slots = db.query(MealPlanSlot).options(
        joinedload(MealPlanSlot.recipe).joinedload(Recipe.ingredients)
    ).filter_by(meal_plan_id=plan_id).all()

    filled_slots = [s for s in slots if s.recipe_id and s.recipe]
    if not filled_slots:
        raise HTTPException(status_code=400, detail="No recipes assigned to slots yet")

    pantry = db.query(PantryItem).filter_by(user_id=user_id).all()
    pantry_map = {p.ingredient_name.lower().strip(): p.quantity for p in pantry}

    ingredient_map = {}
    for slot in filled_slots:
        recipe = slot.recipe
        ratio = (slot.servings_override or recipe.servings) / recipe.servings
        for ing in recipe.ingredients:
            key = ing.ingredient_name.lower().strip()
            if key in ingredient_map:
                ingredient_map[key]["quantity"] += (ing.quantity or 0) * ratio
            else:
                ingredient_map[key] = {
                    "ingredient_name": key,
                    "quantity": round((ing.quantity or 0) * ratio, 2),
                    "unit": ing.unit,
                    "category": None,
                    "is_checked": False,
                    "in_pantry": key in pantry_map,
                }

    grocery_list = GroceryList(user_id=user_id, meal_plan_id=plan_id)
    db.add(grocery_list)
    db.flush()

    for data in ingredient_map.values():
        db.add(GroceryItem(grocery_list_id=grocery_list.id, **data))

    db.commit()
    db.refresh(grocery_list)
    return grocery_list
