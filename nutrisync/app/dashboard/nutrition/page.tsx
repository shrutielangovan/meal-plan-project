"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import NutritionCalendar from "./NutritionCalendar";

type LoggedMeal = {
  id: string;
  description: string;
  meal_slot: string | null;
  logged_at: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const GOALS = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 65,
};

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

function CircularProgress({
  value, max, color, label, unit,
}: {
  value: number; max: number; color: string; label: string; unit: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center group">
      <div className="relative w-24 h-24 transition-transform duration-300 group-hover:scale-105">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="8" />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="50" cy="50" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-800">{Math.round(value)}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{unit}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-[9px] text-slate-300">{Math.round(value)}/{max}</p>
    </div>
  );
}

export default function NutritionPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<LoggedMeal[]>([]);
  const [todayLogs, setTodayLogs] = useState<LoggedMeal[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [activeChart, setActiveChart] = useState<"calories" | "macros">("calories");

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    fetchLogs(id);
  }, []);

  const fetchLogs = async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/meal-plans/${uid}/log/history?status=logged`);
      const data: LoggedMeal[] = await res.json();
      setAllLogs(data);

      const today = new Date().toDateString();
      setTodayLogs(data.filter((m) => new Date(m.logged_at).toDateString() === today));

      const weekly = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dayLogs = data.filter(m => new Date(m.logged_at).toDateString() === d.toDateString());
        return {
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          calories: Math.round(dayLogs.reduce((s, m) => s + (m.calories || 0), 0)),
          protein: Math.round(dayLogs.reduce((s, m) => s + (m.protein_g || 0), 0)),
          carbs: Math.round(dayLogs.reduce((s, m) => s + (m.carbs_g || 0), 0)),
          fat: Math.round(dayLogs.reduce((s, m) => s + (m.fat_g || 0), 0)),
        };
      });
      setWeeklyData(weekly);
    } catch (err) {
      console.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const todayTotals = {
    calories: todayLogs.reduce((s, m) => s + (m.calories || 0), 0),
    protein_g: todayLogs.reduce((s, m) => s + (m.protein_g || 0), 0),
    carbs_g: todayLogs.reduce((s, m) => s + (m.carbs_g || 0), 0),
    fat_g: todayLogs.reduce((s, m) => s + (m.fat_g || 0), 0),
  };

  const remainingCals = Math.max(0, GOALS.calories - todayTotals.calories);

  const getAISuggestion = () => {
    if (todayLogs.length === 0) return "Start logging meals to get personalized suggestions!";
    if (todayTotals.calories < 800) return "You're quite behind on calories. A balanced meal with protein and carbs would be great right now!";
    if (todayTotals.protein_g < GOALS.protein_g * 0.5) return "Your protein intake is low. Consider adding chicken, eggs, or legumes to your next meal.";
    if (todayTotals.calories >= GOALS.calories) return "You've hit your calorie goal today! Focus on keeping macros balanced for the rest of the day.";
    return `You need ${Math.round(remainingCals)} more kcal and ${Math.round(GOALS.protein_g - todayTotals.protein_g)}g protein. A protein-rich dinner would be perfect!`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-800">
              Nutrition <span className="text-indigo-600">Dashboard</span>
            </h1>
            <p className="text-slate-500 font-medium">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/dashboard/meal-plan"
              className="bg-white border border-slate-200 px-5 py-2.5 rounded-2xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
            >
              🗓️ Meal Plan
            </a>
            <a
              href={`/dashboard/chat?prompt=Based on my nutrition today (${Math.round(todayTotals.calories)} kcal, ${Math.round(todayTotals.protein_g)}g protein so far), what should I eat for my remaining meals?`}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              💬 Ask AI
            </a>
          </div>
        </header>

        {/* Calendar */}
        <NutritionCalendar logs={allLogs} />

        {/* Weekly summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Avg Daily Calories",
              value: Math.round(weeklyData.reduce((s, d) => s + d.calories, 0) / 7),
              unit: "kcal",
              icon: "🔥",
              color: "bg-purple-50",
              textColor: "text-purple-700",
            },
            {
              label: "Avg Protein",
              value: Math.round(weeklyData.reduce((s, d) => s + d.protein, 0) / 7),
              unit: "g/day",
              icon: "💪",
              color: "bg-green-50",
              textColor: "text-green-700",
            },
            {
              label: "Days Logged",
              value: weeklyData.filter((d) => d.calories > 0).length,
              unit: "/ 7 days",
              icon: "📅",
              color: "bg-blue-50",
              textColor: "text-blue-700",
            },
            {
              label: "Best Day",
              value: weeklyData.reduce((best, d) =>
                d.calories > (best?.calories || 0) ? d : best, weeklyData[0])?.day || "—",
              unit: "most logged",
              icon: "⭐",
              color: "bg-amber-50",
              textColor: "text-amber-700",
            },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-2xl p-4`}>
              <p className="text-2xl mb-1">{stat.icon}</p>
              <p className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.unit}</p>
              <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left column */}
          <div className="lg:col-span-8 space-y-8">

            {/* Progress rings */}
            <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-white">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-extrabold tracking-tight">Daily Progress</h2>
                <div className={`px-4 py-1 rounded-full text-xs font-bold ${
                  todayLogs.length === 0
                    ? "bg-gray-100 text-gray-400"
                    : todayTotals.calories >= GOALS.calories
                    ? "bg-green-100 text-green-600"
                    : "bg-indigo-50 text-indigo-700"
                }`}>
                  {todayLogs.length === 0
                    ? "No meals logged"
                    : todayTotals.calories >= GOALS.calories
                    ? "✓ Goal reached!"
                    : `${Math.round(remainingCals)} kcal left`}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <CircularProgress value={todayTotals.calories} max={GOALS.calories} color="#6366f1" label="Calories" unit="kcal" />
                <CircularProgress value={todayTotals.protein_g} max={GOALS.protein_g} color="#10b981" label="Protein" unit="g" />
                <CircularProgress value={todayTotals.carbs_g} max={GOALS.carbs_g} color="#f59e0b" label="Carbs" unit="g" />
                <CircularProgress value={todayTotals.fat_g} max={GOALS.fat_g} color="#ef4444" label="Fats" unit="g" />
              </div>

              {/* Progress bars */}
              <div className="flex flex-col gap-3">
                {[
                  { label: "Calories", value: todayTotals.calories, max: GOALS.calories, color: "bg-indigo-500", unit: "kcal" },
                  { label: "Protein", value: todayTotals.protein_g, max: GOALS.protein_g, color: "bg-emerald-500", unit: "g" },
                  { label: "Carbs", value: todayTotals.carbs_g, max: GOALS.carbs_g, color: "bg-amber-500", unit: "g" },
                  { label: "Fat", value: todayTotals.fat_g, max: GOALS.fat_g, color: "bg-red-400", unit: "g" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold">{item.label}</span>
                      <span>{Math.round(item.value)}/{item.max}{item.unit}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Today's meals */}
            <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-extrabold tracking-tight">Today's Meals</h2>
                <a href="/dashboard/meal-plan" className="text-indigo-600 text-xs font-bold hover:underline">
                  + Add from Meal Plan
                </a>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {todayLogs.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center text-slate-400">
                      <p className="text-3xl mb-2">🍽️</p>
                      <p className="text-sm font-medium">No meals logged yet.</p>
                      <p className="text-xs mt-1">Select meals from your meal plan to start tracking.</p>
                    </div>
                  ) : (
                    todayLogs.map((meal, i) => (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            {SLOT_EMOJI[meal.meal_slot || ""] || "🍽️"}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">{meal.description}</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{meal.meal_slot}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-xl text-slate-700">
                            {Math.round(meal.calories || 0)}
                            <span className="text-[10px] text-slate-400 ml-1">KCAL</span>
                          </p>
                          <div className="flex gap-2 justify-end mt-1">
                            <span className="text-[10px] font-bold text-emerald-600">P: {Math.round(meal.protein_g || 0)}g</span>
                            <span className="text-[10px] font-bold text-amber-600">C: {Math.round(meal.carbs_g || 0)}g</span>
                            <span className="text-[10px] font-bold text-red-500">F: {Math.round(meal.fat_g || 0)}g</span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-8">

            {/* AI suggestion card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all" />
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span>✨</span> Smart Suggestion
              </h3>
              <p className="text-indigo-100 text-sm leading-relaxed mb-6 font-medium">
                {getAISuggestion()}
              </p>
              <a
                href={`/dashboard/chat?prompt=Based on my nutrition today (${Math.round(todayTotals.calories)} kcal, ${Math.round(todayTotals.protein_g)}g protein so far), what should I eat for my remaining meals?`}
                className="block w-full bg-white text-indigo-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors text-center"
              >
                Ask AI Assistant
              </a>
            </div>

            {/* Weekly trends chart */}
            <section className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-slate-800">Weekly Trends</h3>
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  <button
                    onClick={() => setActiveChart("calories")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      activeChart === "calories" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                    }`}
                  >
                    Cal
                  </button>
                  <button
                    onClick={() => setActiveChart("macros")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      activeChart === "macros" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                    }`}
                  >
                    Macros
                  </button>
                </div>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "calories" ? (
                    <BarChart data={weeklyData}>
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                      />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="calories" radius={[8, 8, 8, 8]} maxBarSize={32}>
                        {weeklyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.calories > 1500 ? "#6366f1" : "#E2E8F0"} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={weeklyData}>
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                      />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="protein" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={12} name="Protein" />
                      <Bar dataKey="carbs" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={12} name="Carbs" />
                      <Bar dataKey="fat" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={12} name="Fat" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            {/* Quick macro breakdown */}
            <section className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <h3 className="font-extrabold text-slate-800 mb-4">Today's Breakdown</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Protein", value: todayTotals.protein_g, max: GOALS.protein_g, color: "bg-emerald-500", emoji: "💪" },
                  { label: "Carbs", value: todayTotals.carbs_g, max: GOALS.carbs_g, color: "bg-amber-400", emoji: "🌾" },
                  { label: "Fat", value: todayTotals.fat_g, max: GOALS.fat_g, color: "bg-red-400", emoji: "🥑" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold flex items-center gap-1">{item.emoji} {item.label}</span>
                      <span>{Math.round(item.value)}g / {item.max}g</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}