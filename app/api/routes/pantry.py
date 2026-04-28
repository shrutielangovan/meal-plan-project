from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import PantryItem
from app.schemas.pantry import PantryItemCreate, PantryItemUpdate, PantryItemResponse
from typing import List
from uuid import UUID
from app.services.unit_normalizer import normalize_unit

router = APIRouter()

@router.get("/{user_id}", response_model=List[PantryItemResponse])
def get_pantry(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(PantryItem).filter_by(user_id=user_id).all()

@router.post("/{user_id}", response_model=PantryItemResponse)
def add_pantry_item(user_id: UUID, item_in: PantryItemCreate, db: Session = Depends(get_db)):
    norm_qty, norm_unit = normalize_unit(item_in.quantity, item_in.unit)  # ✅ add this
    
    existing = db.query(PantryItem).filter_by(
        user_id=user_id,
        ingredient_name=item_in.ingredient_name.lower().strip()
    ).first()

    if existing:
        if item_in.quantity is not None:
            existing_norm_qty, _ = normalize_unit(existing.quantity, existing.unit)
            existing.quantity = (existing_norm_qty or 0) + (norm_qty or 0)
            existing.unit = norm_unit
        db.commit()
        db.refresh(existing)
        return existing

    item = PantryItem(
        user_id=user_id,
        ingredient_name=item_in.ingredient_name.lower().strip(),
        quantity=norm_qty,
        unit=norm_unit,
        expires_at=item_in.expires_at,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.patch("/{user_id}/{item_id}", response_model=PantryItemResponse)
def update_pantry_item(user_id: UUID, item_id: UUID, item_in: PantryItemUpdate, db: Session = Depends(get_db)):
    item = db.query(PantryItem).filter_by(id=item_id, user_id=user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item_in.model_dump(exclude_none=True)
    
    # Normalize if quantity or unit is being updated
    if "quantity" in update_data or "unit" in update_data:
        new_qty = update_data.get("quantity", item.quantity)
        new_unit = update_data.get("unit", item.unit)
        norm_qty, norm_unit = normalize_unit(new_qty, new_unit)  # ✅ add this
        update_data["quantity"] = norm_qty
        update_data["unit"] = norm_unit

    for field, value in update_data.items():
        setattr(item, field, value)

    if item.quantity is not None and item.quantity <= 0:
        db.delete(item)
        db.commit()
        return Response(status_code=204)

    db.commit()
    db.refresh(item)
    return item