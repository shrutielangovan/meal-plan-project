import httpx
import base64
import os
import uuid
from app.core.config import settings

IMAGEN_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"imagen-4.0-generate-001:predict?key={settings.gemini_api_key}"
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUBLIC_DIR = os.path.join(BASE_DIR, "nutrisync", "public", "meal-images")

print("🔍 __file__:", os.path.abspath(__file__))
print("🔍 BASE_DIR:", BASE_DIR)
print("🔍 PUBLIC_DIR:", PUBLIC_DIR)

def ensure_dir():
    os.makedirs(PUBLIC_DIR, exist_ok=True)

async def generate_meal_image(description: str) -> str | None:
    ensure_dir()
    print(f"🟡 Generating image for: {description}")
    print(f"📁 Saving to: {PUBLIC_DIR}")

    prompt = f"Realistic appetizing food photography of: {description}. Professional food photography, natural lighting, clean white background, top-down shot."

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                IMAGEN_URL,
                json={
                    "instances": [{"prompt": prompt}],
                    "parameters": {"sampleCount": 1}
                }
            )
            print(f"🔴 Imagen status: {res.status_code}")
            res.raise_for_status()
            data = res.json()

        predictions = data.get("predictions", [])
        if predictions and "bytesBase64Encoded" in predictions[0]:
            image_data = predictions[0]["bytesBase64Encoded"]
            filename = f"{uuid.uuid4()}.jpg"
            filepath = os.path.join(PUBLIC_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(image_data))
            print(f"✅ Image saved: {filepath}")
            return f"/meal-images/{filename}"

    except Exception as e:
        print(f"❌ Image generation failed: {e}")
        return None
    
async def get_or_generate_meal_image(description: str, db) -> str | None:
    """
    Checks if we already have a generated image for this meal description.
    If yes, reuse it. If no, generate a new one.
    """
    from app.models.meal_plan import LoggedMeal
    
    # ✅ Look for existing image for same description
    existing = db.query(LoggedMeal).filter(
        LoggedMeal.description.ilike(description),
        LoggedMeal.image_url.isnot(None),
    ).first()
    
    if existing:
        print(f"♻️ Reusing existing image for: {description}")
        return existing.image_url
    
    # No existing image — generate new one
    return await generate_meal_image(description)