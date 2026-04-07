"use client";
import { useEffect } from "react";

type Recipe = {
  id: string;
  title: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  prep_time_mins: number | null;
  servings: number;
  instructions: string | null;
  image_url: string | null;
  tags: string[];
  ingredients: { ingredient_name: string; quantity: number | null; unit: string | null }[];
};

export default function RecipePanel({
  recipe,
  onClose,
  onSelect,
  isSelected,
}: {
  recipe: Recipe | null;
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
  isSelected: boolean;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${recipe ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${recipe ? "translate-x-0" : "translate-x-full"}`}>
        {recipe && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg leading-tight pr-4">{recipe.title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl flex-shrink-0">✕</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">

              {/* Image */}
              {recipe.image_url && (
                <img
                  src={recipe.image_url}
                  alt={recipe.title}
                  className="w-full h-48 object-cover rounded-2xl mb-4"
                />
              )}

              {/* Tags */}
              {recipe.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="bg-purple-50 text-purple-600 text-xs px-3 py-1 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Calories", value: recipe.calories ? `${recipe.calories}` : "—", icon: "🔥" },
                  { label: "Protein", value: recipe.protein_g ? `${recipe.protein_g}g` : "—", icon: "💪" },
                  { label: "Carbs", value: recipe.carbs_g ? `${recipe.carbs_g}g` : "—", icon: "🌾" },
                  { label: "Fat", value: recipe.fat_g ? `${recipe.fat_g}g` : "—", icon: "🥑" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg mb-1">{stat.icon}</p>
                    <p className="text-sm font-semibold text-gray-800">{stat.value}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Meta */}
              <div className="flex gap-4 text-sm text-gray-500 mb-6">
                {recipe.prep_time_mins && <span>⏱ {recipe.prep_time_mins} mins</span>}
                {recipe.servings && <span>👥 {recipe.servings} servings</span>}
                {recipe.fiber_g && <span>🌿 {recipe.fiber_g}g fiber</span>}
              </div>

              {/* Ingredients */}
              {recipe.ingredients?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Ingredients</h3>
                  <div className="flex flex-col gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-700 capitalize">{ing.ingredient_name}</span>
                        <span className="text-sm text-gray-400">
                          {ing.quantity ? `${ing.quantity} ${ing.unit || ""}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
                {recipe.instructions && (
                <div className="mb-6">
                    <h3 className="font-semibold text-gray-800 mb-3">Instructions</h3>
                    <div className="flex flex-col gap-3">
                    {recipe.instructions.split(/Step \d+:/).filter(Boolean).map((step, i) => (
                        <div key={i} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{step.trim()}</p>
                        </div>
                    ))}
                    </div>
                </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => onSelect(recipe)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                  isSelected
                    ? "bg-green-500 text-white"
                    : "bg-purple-700 text-white hover:bg-purple-800"
                }`}
              >
                {isSelected ? "✓ Selected for today" : "Choose this meal"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}