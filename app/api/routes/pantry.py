from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import PantryItem
from app.schemas.pantry import PantryItemCreate, PantryItemUpdate, PantryItemResponse
from typing import List
from uuid import UUID

router = APIRouter()

@router.get("/{user_id}", response_model=List[PantryItemResponse])
def get_pantry(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(PantryItem).filter_by(user_id=user_id).all()

@router.post("/{user_id}", response_model=PantryItemResponse)
def add_pantry_item(user_id: UUID, item_in: PantryItemCreate, db: Session = Depends(get_db)):
    existing = db.query(PantryItem).filter_by(
        user_id=user_id,
        ingredient_name=item_in.ingredient_name.lower().strip()
    ).first()

    if existing:
        if item_in.quantity is not None:
            existing.quantity = (existing.quantity or 0) + item_in.quantity
        if item_in.unit is not None:
            existing.unit = item_in.unit
        if item_in.expires_at is not None:
            existing.expires_at = item_in.expires_at
        db.commit()
        db.refresh(existing)
        return existing

    item = PantryItem(
        user_id=user_id,
        ingredient_name=item_in.ingredient_name.lower().strip(),
        **{k: v for k, v in item_in.model_dump().items() if k != "ingredient_name"}
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
    
    for field, value in item_in.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    
    if item.quantity is not None and item.quantity <= 0:
        db.delete(item)
        db.commit()
        return Response(status_code=204)
    
    db.commit()
    db.refresh(item)
    return item