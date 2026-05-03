"""
view_db.py — Print all tables and their contents for NutriSync.
Run from the project root:
    python view_db.py

Make sure Docker DB is running first:
    docker start meal_planner_db
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, inspect, text

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

# Import all models so they are registered
try:
    from app.models.user      import User, UserPreferences, PantryItem
    from app.models.support   import SupportTicket
    from app.models.recipe    import Recipe, RecipeIngredient
    from app.models.meal_plan import MealPlan, MealPlanSlot, LoggedMeal
    from app.models.grocery   import GroceryList, GroceryItem
    from app.models.chat      import ChatSession, ChatMessage
except ImportError as e:
    print(f"Warning — could not import some models: {e}")

DIVIDER = "=" * 100

def truncate(val, max_len=80):
    s = str(val)
    return s[:max_len] + f"... [{len(s)} chars total]" if len(s) > max_len else s

def print_table(conn, table_name, columns):
    try:
        result = conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT 50'))
        rows   = result.fetchall()

        print(f"\n{DIVIDER}")
        print(f"TABLE: {table_name:<35} | {len(columns):>2} columns | {len(rows)} rows")
        print(DIVIDER)

        if not rows:
            print("  (empty)")
            return

        for i, row in enumerate(rows, 1):
            print(f"  --- Row {i} ---")
            for col, val in zip(columns, row):
                print(f"  {col:<30}: {truncate(val)}")
    except Exception as e:
        print(f"  ERROR reading {table_name}: {e}")

def main():
    inspector = inspect(engine)
    tables    = sorted(inspector.get_table_names())

    print(f"\nNutriSync Database — {len(tables)} tables found")
    print(f"DATABASE_URL: {DATABASE_URL[:60]}...")

    with engine.connect() as conn:
        for table in tables:
            if table == "alembic_version":
                continue
            columns = [col["name"] for col in inspector.get_columns(table)]
            print_table(conn, table, columns)

    print(f"\n{DIVIDER}")
    print("Done.")

if __name__ == "__main__":
    main()