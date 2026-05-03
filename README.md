# NutriSync — AI-Powered Meal Planner

---

## ✨ What's New

The following features have been added on top of the original codebase:

- **Google OAuth 2.0** — Passwordless login via Google (SaaS-style, no password required)
- **Email + Password login** — Traditional login with bcrypt password hashing
- **Profile completion flow** — Compulsory step for Google OAuth new users (household size, budget, cook time)
- **My Profile page** — View and edit profile, upload avatar (persisted to DB), meal preferences
- **Support ticket system** — Submit tickets, receive email confirmation, flag follow-ups
- **Gmail SMTP** — Automated emails for ticket confirmation and follow-up notifications
- **Auto table creation** — All DB tables created automatically on server startup via `Base.metadata.create_all()`

---

## Project Structure (Updated)

```
meal-plan-project/
├── app/
│   ├── main.py                    # App entry — auto-creates all DB tables on startup
│   ├── models/
│   │   ├── user.py                # users (+ google_id, is_google_user, profile_picture)
│   │   ├── support.py             # support_tickets table (NEW)
│   │   ├── recipe.py
│   │   ├── meal_plan.py
│   │   ├── grocery.py
│   │   └── chat.py
│   ├── schemas/
│   │   ├── user.py                # UserResponse now includes profile_picture
│   │   ├── support.py             # Support ticket schemas (NEW)
│   │   ├── recipe.py
│   │   ├── pantry.py
│   │   ├── meal_plan.py
│   │   ├── grocery.py
│   │   └── chat.py
│   ├── api/
│   │   └── routes/
│   │       ├── users.py           # + Google OAuth login, profile picture upload
│   │       ├── support.py         # Support ticket endpoints (NEW)
│   │       ├── recipes.py
│   │       ├── pantry.py
│   │       ├── meal_plans.py
│   │       ├── grocery.py
│   │       └── chat.py
│   ├── core/
│   │   └── config.py              # + GOOGLE_CLIENT_ID, SUPPORT_EMAIL, GMAIL_APP_PASSWORD
│   ├── database.py
│   └── main.py
├── scripts/
│   └── seed_recipes.py
├── alembic/
├── view_db.py                     # Dev utility — prints all DB tables 
├── .env.example
└── requirements.txt
```

```
nutrisync/src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── about/page.tsx
│   ├── login/page.tsx             # + Google OAuth button
│   ├── signup/page.tsx            # + Google OAuth button
│   ├── profile/page.tsx           # Full profile page with avatar, edit mode (NEW)
│   ├── support/page.tsx           # Support ticket system (NEW)
│   ├── complete-profile/page.tsx  # Compulsory step for Google OAuth new users (NEW)
│   └── dashboard/
│       ├── page.tsx
│       ├── meal-plan/page.tsx
│       ├── pantry/page.tsx
│       ├── nutrition/page.tsx
│       └── chat/page.tsx
└── components/ui/
    └── Navbar.tsx                 # + Support link, avatar display, avatar-change listener

```

---

## Auto Table Creation on Startup

All database tables are created automatically when the backend server starts. No manual migration runs needed during development.

```python
# app/main.py
Base.metadata.create_all(bind=engine)
```

This uses `CREATE TABLE IF NOT EXISTS` — existing tables and data are never touched. Safe for repeated restarts.

Tables created automatically:
`users`, `user_preferences`, `pantry_items`, `support_tickets`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_slots`, `logged_meals`, `grocery_lists`, `grocery_items`, `chat_sessions`, `chat_messages`

> **Note:** If you add new columns to an existing model, `create_all` will NOT add them automatically. Run the SQL ALTER commands manually — see the DB Schema Changes section below.

---

## Google OAuth Setup

### Step 1 — Create a Google Cloud project

Go to: https://console.cloud.google.com

### Step 2 — Enable Google OAuth

APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID

- Application type: **Web application**
- Name: NutriSync

### Step 3 — Set Authorised JavaScript Origins

```
http://localhost:3000
http://localhost:8000
```

### Step 4 — Copy credentials

Copy **Client ID** and **Client Secret** from the credentials page.

### Step 5 — Add test users (while in Testing mode)

APIs & Services → OAuth consent screen → Test users → Add your Gmail address

---

## Gmail SMTP Setup (Support System Emails)

The support system sends automated emails via Gmail SMTP.

### Step 1 — Enable 2-Factor Authentication on your Gmail

Go to: https://myaccount.google.com/security

### Step 2 — Generate an App Password

Google Account → Security → 2-Step Verification → App passwords

- Select app: **Mail**
- Select device: **Other** → type "NutriSync"
- Copy the 16-character password (e.g. `xxxx xxxx xxxx xxxx`)

### Step 3 — Add to `.env`

```
SUPPORT_EMAIL=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Environment Variables (Updated)

### Backend — `.env`

```
# PostgreSQL
DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@127.0.0.1:5433/meal_planner

# Food & Nutrition APIs
SPOONACULAR_API_KEY=your-key-here
USDA_API_KEY=your-key-here

# Google OAuth 2.0 (Passwordless login)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Gmail SMTP (Support System emails)
SUPPORT_EMAIL=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Frontend — `nutrisync/.env.local`

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GEMINI_API_KEY=your-key-here
SPOONACULAR_API_KEY=your-key-here
USDA_API_KEY=your-key-here
```

---

## DB Schema Changes (Manual SQL)

If you cloned the repo and the `users` table already existed before the new columns were added, run these manually:

```bash
docker exec -it meal_planner_db psql -U postgres -d meal_planner
```

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_google_user BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
```

Then exit:

```sql
\q
```

---

## New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/google-login` | Google OAuth login — verifies ID token, creates user if new |
| POST | `/api/users/{user_id}/picture` | Upload profile picture — saved as base64 in DB |
| POST | `/api/support/submit` | Submit support ticket + send confirmation emails |
| POST | `/api/support/followup` | Flag follow-up on existing ticket |
| GET | `/api/support/tickets/{user_id}` | List user's support tickets |

---

## New Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Profile | `/profile` | View and edit profile, upload avatar |
| Support | `/support` | Submit tickets, view ticket history, flag follow-ups |
| Complete Profile | `/complete-profile` | Compulsory for Google OAuth new users — collects meal preferences |

---

## Install New Dependencies

### Backend

```bash
pip install -r requirements.txt
```

New packages added: `google-auth`, `httpx`, `python-multipart`

### Frontend

```bash
cd nutrisync
npm install @react-oauth/google
```

---

## View Database Contents

A dev utility is included to print all tables and their rows:

```bash
# Make sure docker DB is running first
docker start meal_planner_db

python view_db.py
```

---

## Running the Project

### Backend

```bash
conda activate msds597
docker start meal_planner_db
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd nutrisync
npm run dev
```

Open: http://localhost:3000

---

---

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


# NutriSync — Frontend

The Next.js frontend for NutriSync, an AI-powered personalized meal planner.

---

## Prerequisites

Make sure you have the following installed:

- Node.js 18+
- npm

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/shrutielangovan/meal-plan-project.git
cd meal-plan-project/nutrisync 
```

### 2. Install dependencies
```bash
npm install
```

### 3. Make sure the backend is running

The frontend talks to the FastAPI backend at `http://localhost:8000`.
Follow the backend README to get it running before starting the frontend.

Make sure your backend has CORS enabled for `http://localhost:3000`.

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5.Set up environment variables

Create .env.local under nutrisync folder to access your api keys for Agent specific task

```bash
GEMINI_API_KEY=your-key-here
SPOONACULAR_API_KEY=your-key-here
USDA_API_KEY=your-key-here

```

---

## Project Structure
```
src/
  app/
    page.tsx                  # Home page (session aware)
    layout.tsx                # Root layout with Navbar
    loading.tsx               # Global loading spinner
    about/page.tsx            # About Us page
    login/page.tsx            # Login form
    profile/page.tsx          # User Profile
    signup/page.tsx           # Signup form
    dashboard/
      page.tsx                # Dashboard with feature cards
      meal-plan/page.tsx      # Meal plan (coming soon)
      pantry/page.tsx         # Pantry manager (coming soon)
      nutrition/page.tsx      # Nutrition tracker (coming soon)
      chat/page.tsx           # AI chat agent (coming soon)
  components/ui/
    Navbar.tsx                # Session-aware navbar
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 15 (App Router) | Framework |
| React 19 | UI library |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| Recharts | Nutrition charts (coming soon) |

---

## Key Features Built

- Session-aware Navbar (shows login/signup or username/logout)
- Guest vs logged-in experience on Dashboard
- Freemium model — guests get limited access, full access on login
- Password validation on signup (uppercase, number, special character)
- Auto-redirect to login for protected pages

---

## Session Management

User session is stored in `localStorage` after login:
```
user_id   → used for all API calls
user_name → displayed in navbar and dashboard
```

To log out, the session is cleared and the user is redirected to home.

---

## Backend API

All API calls point to `http://localhost:8000`. Key endpoints used:

| Action | Endpoint |
|--------|----------|
| Register | `POST /api/users/register` |
| Login | `POST /api/users/login` |
| Get Preferences | `GET /api/users/{user_id}/preferences` |
| Update Preferences | `PATCH /api/users/{user_id}/preferences` |

Full backend docs available at `http://localhost:8000/docs` when the server is running.

---

## Notes for Teammates

- Always run `docker start meal_planner_db` before starting the backend
- Backend must be running on port `8000` before starting the frontend
- If you see a CORS error, check that the backend has `http://localhost:3000` in its allowed origins
- If you get a `.next` cache error, run `rm -rf .next && npm install && npm run dev`
