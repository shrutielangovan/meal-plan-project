"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

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
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-sm font-bold text-gray-800">{Math.round(value)}</p>
          <p className="text-xs text-gray-400">{unit}</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="text-xs text-gray-400">{Math.round(value)}/{max}{unit}</p>
      </div>
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

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    fetchLogs(id);
  }, []);

  const fetchLogs = async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/meal-plans/${uid}/log/history`);
      const data: LoggedMeal[] = await res.json();
      setAllLogs(data);

      // Filter today's logs
      const today = new Date().toDateString();
      const todays = data.filter((m) => new Date(m.logged_at).toDateString() === today);
      setTodayLogs(todays);

      // Build weekly data
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });

      const weekly = last7.map((date) => {
        const dayLogs = data.filter(
          (m) => new Date(m.logged_at).toDateString() === date.toDateString()
        );
        return {
          day: date.toLocaleDateString("en-US", { weekday: "short" }),
          date: date.toDateString(),
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Nutrition <span className="text-green-600">Tracker</span>
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Today's progress rings */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-800">Today's Progress</h2>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              todayLogs.length === 0
                ? "bg-gray-100 text-gray-400"
                : todayTotals.calories >= GOALS.calories
                ? "bg-green-100 text-green-600"
                : "bg-amber-100 text-amber-600"
            }`}>
              {todayLogs.length === 0
                ? "No meals logged yet"
                : todayTotals.calories >= GOALS.calories
                ? "✓ Goal reached!"
                : `${remainingCals} cal remaining`}
            </span>
          </div>

          {/* Circular progress rings */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <CircularProgress
              value={todayTotals.calories}
              max={GOALS.calories}
              color="#8B5CF6"
              label="Calories"
              unit="kcal"
            />
            <CircularProgress
              value={todayTotals.protein_g}
              max={GOALS.protein_g}
              color="#10B981"
              label="Protein"
              unit="g"
            />
            <CircularProgress
              value={todayTotals.carbs_g}
              max={GOALS.carbs_g}
              color="#F59E0B"
              label="Carbs"
              unit="g"
            />
            <CircularProgress
              value={todayTotals.fat_g}
              max={GOALS.fat_g}
              color="#EF4444"
              label="Fat"
              unit="g"
            />
          </div>

          {/* Progress bars */}
          <div className="flex flex-col gap-3">
            {[
              { label: "Calories", value: todayTotals.calories, max: GOALS.calories, color: "bg-purple-500", unit: "kcal" },
              { label: "Protein", value: todayTotals.protein_g, max: GOALS.protein_g, color: "bg-green-500", unit: "g" },
              { label: "Carbs", value: todayTotals.carbs_g, max: GOALS.carbs_g, color: "bg-amber-500", unit: "g" },
              { label: "Fat", value: todayTotals.fat_g, max: GOALS.fat_g, color: "bg-red-400", unit: "g" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{item.label}</span>
                  <span>{Math.round(item.value)}/{item.max}{item.unit}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's meal breakdown */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Today's Meals</h2>
          {todayLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm">No meals logged today yet.</p>
              <p className="text-xs mt-1">Select meals from your meal plan to track nutrition.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {todayLogs.map((meal) => (
                <div key={meal.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{SLOT_EMOJI[meal.meal_slot || ""] || "🍽️"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">{meal.description}</p>
                      <p className="text-xs text-gray-400 capitalize">{meal.meal_slot}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Cal", value: meal.calories, color: "text-purple-600" },
                      { label: "Pro", value: meal.protein_g ? `${Math.round(meal.protein_g)}g` : "—", color: "text-green-600" },
                      { label: "Carbs", value: meal.carbs_g ? `${Math.round(meal.carbs_g)}g` : "—", color: "text-amber-600" },
                      { label: "Fat", value: meal.fat_g ? `${Math.round(meal.fat_g)}g` : "—", color: "text-red-500" },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className={`text-xs font-semibold ${stat.color}`}>{stat.value ?? "—"}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly trend charts */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-6">Weekly Trends</h2>

          {/* Calories chart */}
          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-3 font-medium">🔥 Calories (goal: {GOALS.calories})</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="calories" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                {/* Goal line */}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Macros chart */}
          <div>
            <p className="text-sm text-gray-500 mb-3 font-medium">💪 Macros breakdown (g)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="protein" fill="#10B981" radius={[4, 4, 0, 0]} name="Protein" />
                <Bar dataKey="carbs" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Carbs" />
                <Bar dataKey="fat" fill="#EF4444" radius={[4, 4, 0, 0]} name="Fat" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      </div>
    </main>
  );
}