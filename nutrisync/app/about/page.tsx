import Image from "next/image";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-20">

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          About <span className="text-purple-700">NutriSync</span>
        </h1>
        <p className="text-gray-500 text-lg">
          We built NutriSync to make personalized nutrition simple, smart, and actually enjoyable.
        </p>
      </section>

      {/* Mission */}
      <section className="max-w-2xl mx-auto text-center mb-16">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">Our Mission</h2>
        <p className="text-gray-500 leading-relaxed">
          Most people know what they want to eat — they just don't have the time or tools
          to plan it. NutriSync uses AI to generate weekly meal plans, track your macros,
          and adapt to your pantry and goals automatically.
        </p>
      </section>

      {/* Feature cards */}
      <section className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: "🥗", title: "Personalized Plans", desc: "Meal plans tailored to your diet, goals, and cooking time." },
          { icon: "📊", title: "Nutrition Tracking", desc: "See your daily macros broken down per meal, automatically." },
          { icon: "🛒", title: "Smart Grocery Lists", desc: "Consolidated shopping lists based on what you already have." },
        ].map((card) => (
          <div key={card.title} className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-4">{card.icon}</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{card.title}</h3>
            <p className="text-gray-500 text-sm">{card.desc}</p>
          </div>
        ))}
      </section>

    </main>
  );
}