"""
One-time script to normalize all existing pantry item units.
Run with: python -m scripts.normalize_pantry
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import PantryItem
from app.services.unit_normalizer import normalize_unit

def run():
    db = SessionLocal()
    try:
        items = db.query(PantryItem).all()
        print(f"Found {len(items)} pantry items to normalize...")

        updated = 0
        skipped = 0

        for item in items:
            norm_qty, norm_unit = normalize_unit(item.quantity, item.unit)

            if norm_qty != item.quantity or norm_unit != item.unit:
                print(f"  {item.ingredient_name}: {item.quantity} {item.unit} → {norm_qty} {norm_unit}")
                item.quantity = norm_qty
                item.unit = norm_unit
                updated += 1
            else:
                skipped += 1

        db.commit()
        print(f"\n✅ Done — {updated} items updated, {skipped} items unchanged.")

    except Exception as e:
        db.rollback()
        print(f"❌ Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()