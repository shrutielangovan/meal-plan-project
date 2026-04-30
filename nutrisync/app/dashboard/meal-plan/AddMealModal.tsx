"use client";
import { useState, useEffect, useRef } from "react";

type LoggedMeal = {
    id: string;
    description: string;
    meal_slot: string | null;
    logged_at: string;
    calories: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    status?: "logged" | "planned";
    source?: string; 
};

type MacroEstimate = {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    estimated: boolean;
};

type Recipe = {
    id: string;
    title: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    meal_type: string;
};

type Mode = "choose" | "add-new" | "reuse" | "suggestions";

const SLOT_EMOJI: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };
const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const DEFAULT_VISIBLE = 5;

interface Props {
    date: Date | null;
    loggedMeals: LoggedMeal[];
    suggestions: Record<string, string[]>; // slot → [recipeId, ...]
    recipes: Recipe[];
    onClose: () => void;
    onSave: (date: Date, meals: Omit<LoggedMeal, "id" | "logged_at">[]) => Promise<void>;
}

export default function AddMealModal({ date, loggedMeals, suggestions, recipes, onClose, onSave }: Props) {
    const [mode, setMode] = useState<Mode>("choose");

  // Add-new state
    const [slot, setSlot] = useState("breakfast");
    const [description, setDescription] = useState("");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [estimating, setEstimating] = useState(false);
    const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
    const [estimateError, setEstimateError] = useState("");

  // Reuse state
    const [search, setSearch] = useState("");
    const [slotFilter, setSlotFilter] = useState("all");
    const [reuseSlot, setReuseSlot] = useState("breakfast");
    const [selectedReuse, setSelectedReuse] = useState<LoggedMeal[]>([]);
    const [showAll, setShowAll] = useState(false);

    // Suggestions state
    const [suggestionSlot, setSuggestionSlot] = useState("breakfast");
    const [selectedSuggestion, setSelectedSuggestion] = useState<Recipe | null>(null);

    const [saving, setSaving] = useState(false);
    const [isMealPrepped, setIsMealPrepped] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
    if (mode === "add-new") setTimeout(() => inputRef.current?.focus(), 100);
    }, [mode]);

    if (!date) return null;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0);
    const isPast = dateOnly < today;
    const isFuture = dateOnly > today;
    const isToday = dateOnly.toDateString() === today.toDateString();

    const formattedDate = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    // ── Macro estimation ──────────────────────────────────────────────────────
    const macrosAreEmpty = !calories && !protein && !carbs && !fat;

    const handleEstimateMacros = async () => {
    if (!description.trim()) return;
    setEstimating(true); setEstimateError(""); setEstimate(null);
    try {
        const res = await fetch("http://localhost:8000/api/meal-plans/estimate-macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), meal_slot: slot }),
        });
        if (!res.ok) throw new Error();
        const data: MacroEstimate = await res.json();
        setEstimate(data);
        if (macrosAreEmpty) {
        setCalories(String(data.calories));
        setProtein(String(data.protein_g));
        setCarbs(String(data.carbs_g));
        setFat(String(data.fat_g));
        }
    } catch {
        setEstimateError("Couldn't estimate macros. You can still log without them.");
    } finally {
        setEstimating(false);
    }
    };

    const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (estimate) { setEstimate(null); setEstimateError(""); }
    };

    // ── Reuse helpers ─────────────────────────────────────────────────────────
    const uniquePastMeals = Array.from(
    new Map(loggedMeals.map((m) => [m.description.toLowerCase(), m])).values()
    ).sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

    const slotFiltered = slotFilter === "all" ? uniquePastMeals : uniquePastMeals.filter(m => m.meal_slot === slotFilter);
    const searchFiltered = slotFiltered.filter(m => m.description.toLowerCase().includes(search.toLowerCase()));
    const isSearching = search.trim().length > 0;
    const visibleMeals = isSearching || showAll ? searchFiltered : searchFiltered.slice(0, DEFAULT_VISIBLE);
    const hasMore = !isSearching && !showAll && searchFiltered.length > DEFAULT_VISIBLE;

    const toggleReuseSelect = (meal: LoggedMeal) => {
    setSelectedReuse(prev =>
        prev.some(m => m.description === meal.description)
        ? prev.filter(m => m.description !== meal.description)
        : [...prev, meal]
    );
    };

    // ── Suggestions helpers ───────────────────────────────────────────────────
    const getSuggestionRecipes = () => {
    const ids = suggestions[suggestionSlot] || [];
    return ids.map(id => recipes.find(r => r.id === id)).filter(Boolean) as Recipe[];
    };

    // ── Save handlers ─────────────────────────────────────────────────────────
    const handleAddNew = async () => {
    if (!description.trim()) { setError("Please enter a meal description."); return; }
    setSaving(true); setError("");
    try {
        await onSave(date, [{
        description: description.trim(), meal_slot: slot,
        calories: calories ? parseFloat(calories) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
        source: isMealPrepped ? "meal_plan" : "manual",
        }]);
        onClose();
    } catch { setError("Failed to save meal. Please try again."); }
    finally { setSaving(false); }
    };

    const handleReuse = async () => {
    if (selectedReuse.length === 0) { setError("Please select at least one meal to reuse."); return; }
    setSaving(true); setError("");
    try {
        await onSave(date, selectedReuse.map(m => ({
        description: m.description, meal_slot: reuseSlot,
        calories: m.calories, protein_g: m.protein_g ?? null,
        carbs_g: m.carbs_g ?? null, fat_g: m.fat_g ?? null,
        source: isMealPrepped ? "manual" : "meal_plan",
        })));
        onClose();
    } catch { setError("Failed to save meals. Please try again."); }
    finally { setSaving(false); }
    };

    const handleSuggestionSelect = async () => {
    if (!selectedSuggestion) { setError("Please select a meal."); return; }
    setSaving(true); setError("");
    try {
        await onSave(date, [{
        description: selectedSuggestion.title,
        meal_slot: suggestionSlot,
        calories: selectedSuggestion.calories,
        protein_g: selectedSuggestion.protein_g,
        carbs_g: selectedSuggestion.carbs_g,
        fat_g: selectedSuggestion.fat_g,
        source: "meal_plan",
        }]);
        onClose();
    } catch { setError("Failed to save meal. Please try again."); }
    finally { setSaving(false); }
    };

    const resetMode = () => {
    setMode("choose"); setError(""); setSelectedReuse([]);
    setSearch(""); setSlotFilter("all"); setShowAll(false);
    setEstimate(null); setEstimateError(""); setSelectedSuggestion(null);
    setIsMealPrepped(false);
    };

    const hasSuggestions = Object.values(suggestions).some(ids => ids.length > 0);

    return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
        <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
            <div>
            <div className="flex items-center gap-2">
                {mode !== "choose" && (
                <button onClick={resetMode} className="text-gray-400 hover:text-gray-600 mr-1 text-lg leading-none">←</button>
                )}
                <h2 className="font-bold text-gray-900 text-base">
                {mode === "choose" && (isFuture ? "Plan a Meal" : isPast ? "Edit Past Day" : "Add to Today")}
                {mode === "add-new" && (isFuture ? "Plan a New Meal" : "Add a New Meal")}
                {mode === "reuse" && "Re-use a Past Meal"}
                {mode === "suggestions" && "Pick from Suggestions"}
                </h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400">{formattedDate}</p>
                {isFuture && <span className="text-xs bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full">📅 Planning</span>}
            </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition text-sm">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── CHOOSE ── */}
            {mode === "choose" && (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500 mb-1">What would you like to do?</p>

                {/* Pick from suggestions — shown for today and future */}
                {(isToday || isFuture) && hasSuggestions && (
                <button onClick={() => setMode("suggestions")}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition group text-left">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-indigo-200 transition">✨</div>
                    <div>
                    <p className="font-semibold text-gray-800 text-sm">Pick from today's suggestions</p>
                    <p className="text-xs text-gray-400 mt-0.5">AI-curated meals based on your preferences</p>
                    </div>
                    <span className="ml-auto text-gray-300 group-hover:text-indigo-400 text-lg">›</span>
                </button>
                )}

                <button onClick={() => setMode("add-new")}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition group text-left">
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-purple-200 transition">✏️</div>
                <div>
                    <p className="font-semibold text-gray-800 text-sm">{isFuture ? "Plan a custom meal" : "Add a new meal"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Log manually — AI can estimate macros for you</p>
                </div>
                <span className="ml-auto text-gray-300 group-hover:text-purple-400 text-lg">›</span>
                </button>

                <button onClick={() => setMode("reuse")}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-green-300 hover:bg-green-50 transition group text-left">
                <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-green-200 transition">♻️</div>
                <div>
                    <p className="font-semibold text-gray-800 text-sm">Re-use a past meal</p>
                    <p className="text-xs text-gray-400 mt-0.5">Copy meals from your history — great for meal prep</p>
                </div>
                <span className="ml-auto text-gray-300 group-hover:text-green-400 text-lg">›</span>
                </button>

                {uniquePastMeals.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">No meal history yet — start logging to enable re-use.</p>
                )}
            </div>
            )}

            {/* ── SUGGESTIONS ── */}
            {mode === "suggestions" && (
            <div className="flex flex-col gap-4">
                {/* Slot picker */}
                <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Meal Slot</label>
                <div className="grid grid-cols-4 gap-2">
                    {MEAL_SLOTS.map((s) => (
                    <button key={s} onClick={() => { setSuggestionSlot(s); setSelectedSuggestion(null); }}
                        className={`py-2 px-1 rounded-xl text-xs font-medium transition capitalize border-2 ${
                        suggestionSlot === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-50 text-gray-600 border-transparent hover:border-gray-200"
                        }`}>
                        {s}
                    </button>
                    ))}
                </div>
                </div>

                {/* Recipe cards */}
                <div className="flex flex-col gap-2">
                {getSuggestionRecipes().length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No suggestions for {suggestionSlot} yet — try refreshing your meal plan.</p>
                ) : (
                    getSuggestionRecipes().map((recipe) => {
                    const isSelected = selectedSuggestion?.id === recipe.id;
                    return (
                        <button key={recipe.id} onClick={() => setSelectedSuggestion(isSelected ? null : recipe)}
                        className={`flex items-center gap-3 p-3 rounded-xl text-left transition border-2 ${
                            isSelected ? "bg-indigo-50 border-indigo-400" : "bg-gray-50 border-transparent hover:border-gray-200 hover:bg-white"
                        }`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? "bg-indigo-500 border-indigo-500" : "border-gray-300"
                        }`}>
                            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{recipe.title}</p>
                            <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                            {recipe.calories && <span>🔥 {recipe.calories} cal</span>}
                            {recipe.protein_g && <span>💪 {recipe.protein_g}g</span>}
                            </div>
                        </div>
                        </button>
                    );
                    })
                )}
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            )}

            {/* ── ADD NEW ── */}
            {mode === "add-new" && (
            <div className="flex flex-col gap-4">
                <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Meal Slot</label>
                <div className="grid grid-cols-4 gap-2">
                    {MEAL_SLOTS.map((s) => (
                    <button key={s} onClick={() => setSlot(s)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium transition capitalize border-2 ${
                        slot === s ? "bg-purple-700 text-white border-purple-700" : "bg-gray-50 text-gray-600 border-transparent hover:border-gray-200"
                        }`}>
                        {s}
                    </button>
                    ))}
                </div>
                </div>

                <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Meal Description *</label>
                <div className="flex gap-2">
                    <input ref={inputRef} type="text" placeholder="e.g. Grilled chicken with rice"
                    value={description} onChange={(e) => handleDescriptionChange(e.target.value)}
                    onBlur={() => { if (description.trim() && macrosAreEmpty) handleEstimateMacros(); }}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
                    />
                    <button onClick={handleEstimateMacros} disabled={!description.trim() || estimating}
                    title="Estimate macros with AI"
                    className="flex-shrink-0 w-12 flex items-center justify-center bg-purple-50 border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-100 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {estimating ? <span className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" /> : <span className="text-base">✨</span>}
                    </button>
                </div>
                {estimating && <p className="text-xs text-purple-500 mt-1.5">Estimating macros with AI...</p>}
                {estimate && !estimating && <p className="text-xs text-purple-600 mt-1.5">✨ AI estimated — you can adjust below</p>}
                {estimateError && <p className="text-xs text-amber-500 mt-1.5">{estimateError}</p>}
                </div>

                {/* ✅ Home cooked toggle */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Where is this meal from?</p>
                    <div className="grid grid-cols-2 gap-2">
                    <button
                    onClick={() => setIsMealPrepped(true)}
                    className={`flex items-center gap-2 p-2 rounded-xl border-2 text-xs font-medium transition ${
                        isMealPrepped === true ? "bg-green-50 border-green-400 text-green-700" : "bg-gray-50 border-transparent text-gray-500 hover:border-gray-200"
                    }`}>
                    <span>Home cooked</span>
                    </button>
                    <button
                    onClick={() => setIsMealPrepped(false)}
                    className={`flex items-center gap-2 p-2 rounded-xl border-2 text-xs font-medium transition ${
                        isMealPrepped === false ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-gray-50 border-transparent text-gray-500 hover:border-gray-200"
                    }`}>
                    <span>Restaurant / Other</span>
                    </button>
                    </div>
                    </div>

                <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nutrition
                    {estimate ? <span className="ml-2 text-purple-400 font-normal normal-case">(AI estimated)</span>
                    : <span className="ml-1 text-gray-400 font-normal normal-case">(optional)</span>}
                    </label>
                    {(calories || protein || carbs || fat) && (
                    <button onClick={() => { setCalories(""); setProtein(""); setCarbs(""); setFat(""); setEstimate(null); }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                    { label: "🔥 Calories", value: calories, set: setCalories, placeholder: "kcal" },
                    { label: "💪 Protein", value: protein, set: setProtein, placeholder: "grams" },
                    { label: "🌾 Carbs", value: carbs, set: setCarbs, placeholder: "grams" },
                    { label: "🥑 Fat", value: fat, set: setFat, placeholder: "grams" },
                    ].map(({ label, value, set, placeholder }) => (
                    <div key={label}>
                        <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                        <input type="number" min="0" placeholder={placeholder} value={value}
                        onChange={(e) => { set(e.target.value); if (estimate) setEstimate(null); }}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                            estimate && value ? "border-purple-200 bg-purple-50 focus:ring-purple-300" : "border-gray-200 focus:ring-purple-300"
                        }`}
                        />
                    </div>
                    ))}
                </div>
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            )}

            {/* ── REUSE ── */}
            {mode === "reuse" && (
            <div className="flex flex-col gap-4">
                {/* ✅ Home cooked toggle */}
                <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Was this meal prepped at home?</p>
                <div className="grid grid-cols-2 gap-2">
                    <button
                    onClick={() => setIsMealPrepped(true)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition ${
                        isMealPrepped ? "bg-green-50 border-green-400 text-green-700" : "bg-gray-50 border-transparent text-gray-500 hover:border-gray-200"
                    }`}>
                    <span>Yes, meal prepped</span>
                    </button>
                    <button
                    onClick={() => setIsMealPrepped(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition ${
                        !isMealPrepped ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-gray-50 border-transparent text-gray-500 hover:border-gray-200"
                    }`}>
                    <span>No, made fresh</span>
                    </button>
                </div>


                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Log selected meals as</label>
                <div className="grid grid-cols-4 gap-2">
                    {MEAL_SLOTS.map((s) => (
                    <button key={s} onClick={() => setReuseSlot(s)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium transition capitalize border-2 ${
                        reuseSlot === s ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-600 border-transparent hover:border-gray-200"
                        }`}>
                        {s}
                    </button>
                    ))}
                </div>
                </div>

                <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Filter history by slot</label>
                <div className="flex gap-1.5 flex-wrap">
                    {["all", ...MEAL_SLOTS].map((s) => (
                    <button key={s} onClick={() => { setSlotFilter(s); setShowAll(false); }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition capitalize ${
                        slotFilter === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}>
                        {s === "all" ? "All" : s}
                    </button>
                    ))}
                </div>
                </div>

                <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input type="text" placeholder="Search past meals..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
                />
                </div>

                {selectedReuse.length > 0 && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-xs text-green-700 font-medium">{selectedReuse.length} meal{selectedReuse.length > 1 ? "s" : ""} selected</span>
                    <button onClick={() => setSelectedReuse([])} className="text-xs text-green-600 hover:text-green-800 underline">Clear</button>
                </div>
                )}

                <div className="flex flex-col gap-2">
                {visibleMeals.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                    {search ? "No meals match your search." : slotFilter !== "all" ? `No ${slotFilter} meals in your history.` : "No past meals found."}
                    </p>
                ) : (
                    <>
                    {visibleMeals.map((meal) => {
                        const isSelected = selectedReuse.some(m => m.description === meal.description);
                        const logDate = new Date(meal.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        return (
                        <button key={meal.id} onClick={() => toggleReuseSelect(meal)}
                            className={`flex items-center gap-3 p-3 rounded-xl text-left transition border-2 ${
                            isSelected ? "bg-green-50 border-green-400" : "bg-gray-50 border-transparent hover:border-gray-200 hover:bg-white"
                            }`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? "bg-green-500 border-green-500" : "border-gray-300"
                            }`}>
                            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{meal.description}</p>
                            <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                                {meal.calories && <span>🔥 {Math.round(meal.calories)}</span>}
                                {meal.protein_g && <span>💪 {Math.round(meal.protein_g)}g</span>}
                                <span className="capitalize">{meal.meal_slot || "meal"}</span>
                            </div>
                            </div>
                            <span className="text-xs text-gray-300 flex-shrink-0">{logDate}</span>
                        </button>
                        );
                    })}
                    {hasMore && (
                        <button onClick={() => setShowAll(true)}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition">
                        Show {searchFiltered.length - DEFAULT_VISIBLE} more meals
                        </button>
                    )}
                    {showAll && searchFiltered.length > DEFAULT_VISIBLE && (
                        <button onClick={() => setShowAll(false)}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition">
                        Show less
                        </button>
                    )}
                    </>
                )}
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            )}
        </div>

        {/* Footer */}
        {mode !== "choose" && (
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
                onClick={
                mode === "add-new" ? handleAddNew
                : mode === "reuse" ? handleReuse
                : handleSuggestionSelect
                }
                disabled={saving || estimating || (mode === "suggestions" && !selectedSuggestion)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
                mode === "add-new" ? "bg-purple-700 text-white hover:bg-purple-800"
                : mode === "suggestions" ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-green-600 text-white hover:bg-green-700"
                }`}>
                {saving ? "Saving..."
                : mode === "add-new" ? (isFuture ? "Plan Meal" : "Log Meal")
                : mode === "suggestions" ? (selectedSuggestion ? `${isFuture ? "Plan" : "Log"} ${selectedSuggestion.title}` : "Select a meal")
                : `Add ${selectedReuse.length > 0 ? selectedReuse.length : ""} Meal${selectedReuse.length !== 1 ? "s" : ""} to ${formattedDate}`}
            </button>
            </div>
        )}
        </div>
    </div>
    );
}
