# Meal Planner — Backend Setup Guide
---

## Prerequisites

Make sure you have the following installed before starting:

- Python 3.12+
- Docker Desktop (for the database)
- Git

---

## 1. Clone the repo

```bash
git clone https://github.com/shrutielangovan/meal-plan-project.git
cd meal-plan-project
```

---

## 2. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt. You'll need to run this activation command every time you open a new terminal.

---

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

If you hit a zsh error with square brackets, install these separately:

```bash
pip install "passlib[bcrypt]"
pip install "python-jose[cryptography]"
pip install "pydantic[email]"
```

---

## 4. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and update:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meal_planner
SPOONACULAR_API_KEY=your-key-here
USDA_API_KEY=your-key-here
```

To get API keys:
- **Spoonacular** → [spoonacular.com/food-api](https://spoonacular.com/food-api) — free tier gives 150 points/day
- **USDA FDC** → [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-guide.html) — completely free, no rate limits

---

## 5. Start the database

We use Docker for Postgres — one command, no installation needed:

```bash
docker run -d \
  --name meal_planner_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=meal_planner \
  -p 5432:5432 \
  postgres:16
```

To start/stop the database in future sessions:

```bash
docker start meal_planner_db   # start
docker stop meal_planner_db    # stop
```

---

## 6. Run database migrations

This creates all 12 tables in the database:

```bash
alembic upgrade head
```

Verify the tables were created:

```bash
docker exec -it meal_planner_db psql -U postgres -d meal_planner -c "\dt"
```

You should see 13 entries (12 tables + `alembic_version`).

---

## 7. Seed recipe data

This fetches recipes from Spoonacular and populates the `recipes` and `recipe_ingredients` tables.

> **Note:** The free Spoonacular tier allows ~150 API points per day. Each recipe costs 2 points, so run the script across 3 days to seed all recipes. The script is safe to re-run — it skips duplicates automatically.

```bash
python scripts/seed_recipes.py
```

**Day 1** → leave `OFFSET = 0` in the script (default)

**Day 2** → open `scripts/seed_recipes.py` and change `OFFSET = 13`, then re-run

**Day 3** → change `OFFSET = 26`, then re-run

---

## 8. Start the server

```bash
uvicorn app.main:app --reload
```

The API is now running at `http://localhost:8000`

---

## API Documentation

FastAPI auto-generates interactive docs. Open your browser at:

```
http://localhost:8000/docs
```

You can test every endpoint directly from the browser — no Postman needed.

---

## Project Structure

```
meal-planner/
├── app/
│   ├── models/              # SQLAlchemy table definitions
│   │   ├── user.py          # users, user_preferences, pantry_items
│   │   ├── recipe.py        # recipes, recipe_ingredients
│   │   ├── meal_plan.py     # meal_plans, meal_plan_slots, logged_meals
│   │   ├── grocery.py       # grocery_lists, grocery_items
│   │   └── chat.py          # chat_sessions, chat_messages
│   ├── schemas/             # Pydantic request/response models
│   │   ├── user.py
│   │   ├── recipe.py
│   │   ├── pantry.py
│   │   ├── meal_plan.py
│   │   ├── grocery.py
│   │   └── chat.py
│   ├── api/
│   │   └── routes/          # One file per resource
│   │       ├── users.py
│   │       ├── recipes.py
│   │       ├── pantry.py
│   │       ├── meal_plans.py
│   │       ├── grocery.py
│   │       └── chat.py
│   ├── core/
│   │   └── config.py        # Environment variable config
│   ├── database.py          # DB connection + session
│   └── main.py              # FastAPI app entry point
├── scripts/
│   └── seed_recipes.py      # Spoonacular seeding script
├── alembic/                 # Migration files
├── .env                     # Your local secrets (never commit)
├── .env.example             # Template for teammates
└── requirements.txt
```

---

## Available Endpoints

| Group | Base Path | Description |
|-------|-----------|-------------|
| Users | `/api/users` | Register, get, update profile, preferences, deactivate |
| Recipes | `/api/recipes` | Search, filter by meal type and tags |
| Pantry | `/api/pantry` | Add, update, auto-delete when quantity hits 0 |
| Meal Plans | `/api/meal-plans` | Create plans, update slots, archive, log meals |
| Grocery | `/api/grocery` | Generate from plan, track items, auto-sync pantry |
| Chat | `/api/chat` | Sessions and messages for the AI agent |

---

## Validation Rules

**Password** must have:
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character (`!@#$%^&*` etc.)

**`plan_type`** must be one of: `weekly` | `daily` | `on_demand`

**`meal_slot`** must be one of: `breakfast` | `lunch` | `dinner` | `snack`

**`day_of_week`** must be between `0` (Monday) and `6` (Sunday)
