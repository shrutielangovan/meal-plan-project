UNIT_TO_GRAMS = {
    "kg": 1000, "g": 1, "oz": 28.35, "lb": 453.6,
    "lbs": 453.6, "pound": 453.6, "pounds": 453.6,
}

UNIT_TO_ML = {
    "l": 1000, "liter": 1000, "liters": 1000,
    "ml": 1, "cup": 240, "cups": 240,
    "tbsp": 15, "tablespoon": 15, "tablespoons": 15,
    "tsp": 5, "teaspoon": 5, "teaspoons": 5,
    "fl oz": 30, "pint": 473, "quart": 946,
}

COUNTABLE_UNITS = {
    "piece", "pieces", "slice", "slices", "clove", "cloves",
    "egg", "eggs", "can", "cans", "bag", "bags", "bunch",
    "bottle", "bottles", "pack", "packs", "serving", "servings",
    "large", "medium", "small",
}

def normalize_unit(quantity: float | None, unit: str | None) -> tuple[float | None, str | None]:
    """
    Normalizes quantity and unit to standard units.
    Returns (normalized_quantity, normalized_unit)
    """
    if quantity is None or unit is None:
        return quantity, unit

    unit_lower = unit.lower().strip()

    # Keep countable units as-is
    if unit_lower in COUNTABLE_UNITS:
        return round(quantity, 2), unit_lower

    # Convert to grams
    if unit_lower in UNIT_TO_GRAMS:
        return round(quantity * UNIT_TO_GRAMS[unit_lower], 2), "g"

    # Convert to ml
    if unit_lower in UNIT_TO_ML:
        return round(quantity * UNIT_TO_ML[unit_lower], 2), "ml"

    # Unknown unit — return as-is
    return round(quantity, 2) if quantity else quantity, unit_lower