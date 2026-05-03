from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

# ── Import ALL models so create_all() registers every table ──────────────────
# If a model is not imported here, SQLAlchemy won't create its table.
from app.models.user import User, UserPreferences, PantryItem  # noqa: F401
from app.models.support import SupportTicket                    # noqa: F401

# Import remaining models from their existing files
try:
    from app.models.recipe import Recipe, RecipeIngredient      # noqa: F401
    from app.models.meal_plan import MealPlan, MealPlanSlot, LoggedMeal  # noqa: F401
    from app.models.grocery import GroceryList, GroceryItem     # noqa: F401
    from app.models.chat import ChatSession, ChatMessage         # noqa: F401
except ImportError as e:
    print(f"[startup] Could not import some models: {e}")

# Auto-create all tables on startup — safe for repeated restarts
# Uses CREATE TABLE IF NOT EXISTS — existing data is never touched
Base.metadata.create_all(bind=engine)

from app.api.routes import users, recipes, pantry, meal_plans, grocery, chat, support

app = FastAPI(
    title="NutriSync API",
    version="1.0.0"
)

# CORS — allow frontend on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing routers
app.include_router(users.router,      prefix="/api/users",      tags=["Users"])
app.include_router(recipes.router,    prefix="/api/recipes",    tags=["Recipes"])
app.include_router(pantry.router,     prefix="/api/pantry",     tags=["Pantry"])
app.include_router(meal_plans.router, prefix="/api/meal-plans", tags=["Meal Plans"])
app.include_router(grocery.router,    prefix="/api/grocery",    tags=["Grocery"])
app.include_router(chat.router,       prefix="/api/chat",       tags=["Chat"])

# New — Support system
app.include_router(support.router,    prefix="/api/support",    tags=["Support"])

@app.get("/")
def root():
    return {"status": "ok", "message": "NutriSync API is running"}