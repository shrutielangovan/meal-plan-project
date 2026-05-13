# NutriSync — AI-Powered Meal Planner

NutriSync is an AI-powered, agentic meal planning platform designed to personalize the daily nutrition experience for individuals and households. By combining rule-based recommendation engines with large language model (LLM) capabilities, NutriSync moves beyond static meal suggestions to deliver dynamic, context-aware dietary guidance tailored to each user's restrictions, goals, pantry inventory, and schedule.

The platform addresses a core gap in existing nutrition apps: the inability to adapt to real-world variability such as changing pantry stocks, evolving dietary goals/restrictions, meal-prep habits, and spontaneous cravings. NutriSync handles all of these through an interconnected pipeline.

## Project Structure

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

# Backend Setup Guide

> During initial set-up please run the back-end code before running the script - 'scripts/seed_recipes.py' as this would create the new DB and tables
> API Keys Available in the Report


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
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meal_planner

SPOONACULAR_API_KEY=your_api_key_here

GEMINI_API_KEY=your_api_key_here

# Google Oauth Login Approach (Modern Saas trend - Passwordless login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Gmail SMTP for Support System
SUPPORT_EMAIL=
GMAIL_APP_PASSWORD=
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

## 6.  Auto Table Creation on Startup

All database tables are created automatically when the backend server starts. No manual migration runs needed during development.

```python
# app/main.py
Base.metadata.create_all(bind=engine)
```

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

# If the above code errors please try:
python -m uvicorn app.main:app --reload
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

# Frontend Setup Guide

## Prerequisites

Make sure you have the following installed:

- Node.js 18+
- npm

---

## Getting Started

### 1. Install dependencies
```bash
cd nutrisync
npm install
```

### 2. Make sure the backend is running

The frontend talks to the FastAPI backend at `http://localhost:8000`.
Follow the backend README to get it running before starting the frontend.

Make sure your backend has CORS enabled for `http://localhost:3000`.

### 3.Set up environment variables

Create .env.local under nutrisync folder to access your api keys for Agent specific task

```bash
GEMINI_API_KEY=your_api_key_here
SPOONACULAR_API_KEY=your_api_key_here
USDA_API_KEY=

# Google Oauth Login Approach (Modern Saas trend - Passwordless login)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_api_key_here
GOOGLE_CLIENT_SECRET=GOCSPX-s-your_api_key_here

# Gmail SMTP for Support System
SUPPORT_EMAIL=
GMAIL_APP_PASSWORD=
```

### 4. Run the development server
```bash
cd nutrisync
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


---

# Google OAuth Setup

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
