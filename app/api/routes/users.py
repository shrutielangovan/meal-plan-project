from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserPreferences
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserPreferencesUpdate, UserPreferencesResponse
from passlib.context import CryptContext
from uuid import UUID

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter_by(email=user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        hashed_password=pwd_context.hash(user_in.password),
        name=user_in.name,
        household_size=user_in.household_size,
        budget_weekly=user_in.budget_weekly,
        cooking_time_mins=user_in.cooking_time_mins,
    )
    db.add(user)
    db.flush()

    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: UUID, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    return user

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: UUID, user_in: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in user_in.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}/preferences", response_model=UserPreferencesResponse)
def get_preferences(user_id: UUID, db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs

@router.patch("/{user_id}/preferences", response_model=UserPreferencesResponse)
def update_preferences(user_id: UUID, prefs_in: UserPreferencesUpdate, db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter_by(user_id=user_id).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    for field, value in prefs_in.model_dump(exclude_none=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs

@router.patch("/{user_id}/deactivate")
def deactivate_account(user_id: UUID, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is already deactivated")
    user.is_active = False
    db.commit()
    return {"message": "Account deactivated successfully"}