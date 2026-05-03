"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name:              "",
    email:             "",
    password:          "",
    household_size:    1,
    budget_weekly:     0,
    cooking_time_mins: 0,
  });
  const [error, setError]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validatePassword = (password: string) => {
    if (password.length < 8)               return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password))           return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(password))           return "Password must contain at least one number";
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password))
                                           return "Password must contain at least one special character";
    return null;
  };

  // Email / password signup
  const handleSubmit = async () => {
    const passwordError = validatePassword(form.password);
    if (passwordError) { setError(passwordError); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/users/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          household_size:    Number(form.household_size),
          budget_weekly:     Number(form.budget_weekly),
          cooking_time_mins: Number(form.cooking_time_mins),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Something went wrong");
        return;
      }

      router.push("/login");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth signup
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/users/google-login?token=${credentialResponse.credential}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Google sign up failed");
        return;
      }

      const data = await res.json();
      localStorage.setItem("user_id",   data.user_id);
      localStorage.setItem("user_name", data.name);
      window.dispatchEvent(new Event("auth-change"));

      if (data.is_new_user || !data.profile_complete) {
        localStorage.setItem("is_google_user", "true");
        router.push("/complete-profile");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Could not connect to server");
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Create your <span className="text-purple-700">NutriSync</span> account
          </h1>
          <p className="text-gray-400 text-sm mb-6">Start planning smarter meals today</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <input name="name"  placeholder="Full name" onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />
            <input name="email" type="email" placeholder="Email" onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />

            {/* Password with info tooltip */}
            <div className="relative">
              <input name="password" type="password" placeholder="Password" onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />
              <button type="button"
                onMouseEnter={() => setShowPasswordInfo(true)}
                onMouseLeave={() => setShowPasswordInfo(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 text-sm font-bold"
              >ⓘ</button>
              {showPasswordInfo && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-10 w-64 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800 mb-2">Password must have:</p>
                  <ul className="flex flex-col gap-1">
                    <li>✅ At least 8 characters</li>
                    <li>✅ One uppercase letter (A-Z)</li>
                    <li>✅ One number (0-9)</li>
                    <li>✅ One special character (!@#$...)</li>
                  </ul>
                </div>
              )}
            </div>

            <input name="household_size"    type="number" placeholder="Household size (e.g. 2)"      onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />
            <input name="budget_weekly"     type="number" placeholder="Weekly budget ($)"            onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />
            <input name="cooking_time_mins" type="number" placeholder="Max cooking time (mins)"      onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400" />

            <button onClick={handleSubmit} disabled={loading}
              className="bg-purple-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-800 transition disabled:opacity-50">
              {loading ? "Creating account..." : "Sign Up"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google signup */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign up failed")}
                text="signup_with"
                shape="rectangular"
                theme="outline"
                size="large"
              />
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-700 hover:underline">Log in</Link>
          </p>
        </div>
      </main>
    </GoogleOAuthProvider>
  );
}