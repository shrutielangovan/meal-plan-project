"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface UserData {
  id:                string;
  name:              string;
  email:             string;
  household_size:    number;
  budget_weekly:     number;
  cooking_time_mins: number;
  created_at:        string;
  profile_picture?:  string;
}

export default function ProfilePage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser]       = useState<UserData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<UserData>>({});
  const [avatar, setAvatar]   = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) { router.push("/login"); return; }

    fetch(`http://localhost:8000/api/users/${userId}`)
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setForm({
          name:              data.name,
          household_size:    data.household_size,
          budget_weekly:     data.budget_weekly,
          cooking_time_mins: data.cooking_time_mins,
        });
        // Load saved profile picture from DB
        if (data.profile_picture) {
          setAvatar(data.profile_picture);
          window.dispatchEvent(new CustomEvent("avatar-change", { detail: data.profile_picture }));
        }
      })
      .catch(() => setError("Failed to load profile"));
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatar(url);
      window.dispatchEvent(new CustomEvent("avatar-change", { detail: url }));
    };
    reader.readAsDataURL(file);

    // Upload to backend — saved to DB profile_picture column
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`http://localhost:8000/api/users/${userId}/picture`, {
        method: "POST",
        body:   formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAvatar(data.profile_picture);
        window.dispatchEvent(new CustomEvent("avatar-change", { detail: data.profile_picture }));
      }
    } catch {
      // Preview still shows even if upload fails
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId || !user) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`http://localhost:8000/api/users/${userId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:              form.name,
          household_size:    Number(form.household_size),
          budget_weekly:     Number(form.budget_weekly),
          cooking_time_mins: Number(form.cooking_time_mins),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to save");
        return;
      }

      const updated = await res.json();
      setUser(updated);
      setEditing(false);
      setSuccess("Profile updated successfully");
      localStorage.setItem("user_name", updated.name);
      window.dispatchEvent(new Event("auth-change"));
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    setForm({
      name:              user.name,
      household_size:    user.household_size,
      budget_weekly:     user.budget_weekly,
      cooking_time_mins: user.cooking_time_mins,
    });
    setEditing(false);
    setError("");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  const initials   = user.name?.charAt(0).toUpperCase() || "?";
  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">

        {/* Banners */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            <span>✓</span> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            <span>✕</span> {error}
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Purple banner */}
          <div className="h-20 bg-gradient-to-r from-purple-600 to-purple-800" />

          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-10 mb-4">
              {/* Avatar */}
              <div className="relative">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-md hover:opacity-90 transition"
                  title="Click to change photo"
                >
                  {avatar
                    ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                    : initials
                  }
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white text-xs hover:bg-purple-800 shadow"
                >
                  ✎
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>

              {/* Edit button */}
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 border border-purple-200 text-purple-700 text-sm rounded-lg hover:bg-purple-50 transition font-medium"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleCancel}
                    className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={loading}
                    className="px-4 py-2 bg-purple-700 text-white text-sm rounded-lg hover:bg-purple-800 transition disabled:opacity-50 font-medium">
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {/* Name + email */}
            <div>
              {editing ? (
                <input
                  name="name"
                  value={form.name || ""}
                  onChange={handleChange}
                  className="text-xl font-bold text-gray-900 border-b border-purple-300 outline-none w-full mb-1 bg-transparent focus:border-purple-600"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              )}
              <p className="text-sm text-gray-400">{user.email}</p>
              <p className="text-xs text-gray-300 mt-1">Member since {memberSince}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Household",  value: `${user.household_size}`,    suffix: "people",   icon: "👨‍👩‍👧" },
            { label: "Budget",     value: `$${user.budget_weekly}`,    suffix: "/ week",   icon: "💰" },
            { label: "Cook Time",  value: `${user.cooking_time_mins}`, suffix: "mins max", icon: "⏱️" },
          ].map(({ label, value, suffix, icon }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-lg font-bold text-purple-700">{value}</p>
              <p className="text-xs text-gray-400">{suffix}</p>
              <p className="text-xs text-gray-300 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Meal Preferences Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🥗 Meal Preferences
          </h2>
          <div className="flex flex-col gap-4">
            {[
              { label: "Household Size",       name: "household_size",    suffix: "people",   type: "number", min: "1" },
              { label: "Weekly Grocery Budget", name: "budget_weekly",     suffix: "$ / week", type: "number", min: "0" },
              { label: "Max Cooking Time",      name: "cooking_time_mins", suffix: "mins",     type: "number", min: "1" },
            ].map(({ label, name, suffix, type, min }) => (
              <div key={name} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        name={name}
                        type={type}
                        min={min}
                        value={(form as any)[name] || ""}
                        onChange={handleChange}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-400 w-28"
                      />
                      <span className="text-sm text-gray-400">{suffix}</span>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-800">
                      {(user as any)[name]} <span className="text-gray-400 font-normal">{suffix}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🔐 Account
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-800">{user.email}</p>
              </div>
              <span className="text-xs text-gray-300 bg-gray-50 px-2 py-1 rounded">Read only</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Member since</p>
                <p className="text-sm text-gray-800">{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}