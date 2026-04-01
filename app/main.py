from fastapi import FastAPI
from app.api.routes import users, recipes, pantry, meal_plans, grocery, chat
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Meal Planner API",
    version="1.0.0"
)

#CORS configuration to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(recipes.router, prefix="/api/recipes", tags=["Recipes"])
app.include_router(pantry.router, prefix="/api/pantry", tags=["Pantry"])
app.include_router(meal_plans.router, prefix="/api/meal-plans", tags=["Meal Plans"])
app.include_router(grocery.router, prefix="/api/grocery", tags=["Grocery"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

@app.get("/")
def root():
    return {"status": "ok", "message": "Meal Planner API is running"}


