from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserPreferences
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserPreferencesUpdate, UserPreferencesResponse
from app.core.config import settings
from passlib.context import CryptContext
from uuid import UUID
import httpx

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ── Email / Password auth ─────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter_by(email=user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email             = user_in.email,
        hashed_password   = pwd_context.hash(user_in.password),
        name              = user_in.name,
        household_size    = user_in.household_size,
        budget_weekly     = user_in.budget_weekly,
        cooking_time_mins = user_in.cooking_time_mins,
    )
    db.add(user)
    db.flush()

    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "user_id":       str(user.id),
        "name":          user.name,
        "is_google_user": user.is_google_user,
    }


# ── Google OAuth Login ────────────────────────────────────────────────────────

@router.post("/google-login")
async def google_login(token: str, db: Session = Depends(get_db)):
    """
    Frontend receives Google ID token and sends it here.
    Backend verifies with Google's tokeninfo API.

    Flow:
      New user    → creates account → returns is_new_user=True → frontend redirects to /complete-profile
      Existing    → returns is_new_user=False → frontend redirects to /dashboard
    """
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        )
        token_data = res.json()

    if "error" in token_data:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    if token_data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    google_id = token_data.get("sub")
    email     = token_data.get("email")
    name      = token_data.get("name")

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Missing Google account info")

    # Check if user exists by google_id or email
    user = (
        db.query(User).filter(User.google_id == google_id).first()
        or db.query(User).filter(User.email == email).first()
    )

    is_new_user = False

    if not user:
        # New user — create account
        user = User(
            email          = email,
            name           = name,
            google_id      = google_id,
            is_google_user = True,
            hashed_password = None,   # Google users have no password
        )
        db.add(user)
        db.flush()
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(user)
        is_new_user = True
    else:
        # Existing user — link google_id if not already linked
        if not user.google_id:
            user.google_id      = google_id
            user.is_google_user = True
            db.commit()
            db.refresh(user)

    # Check if profile is complete (household_size, budget set)
    profile_complete = user.household_size is not None and user.budget_weekly is not None

    return {
        "user_id":         str(user.id),
        "name":            user.name,
        "email":           user.email,
        "is_google_user":  True,
        "is_new_user":     is_new_user,
        "profile_complete": profile_complete,
    }


# ── Profile endpoints ─────────────────────────────────────────────────────────

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