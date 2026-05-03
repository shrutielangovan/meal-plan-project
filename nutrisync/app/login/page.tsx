"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Email / password login
  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/users/login?email=${encodeURIComponent(form.email)}&password=${encodeURIComponent(form.password)}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Invalid email or password");
        return;
      }

      const data = await res.json();
      localStorage.setItem("user_id",   data.user_id);
      localStorage.setItem("user_name", data.name);
      window.dispatchEvent(new Event("auth-change"));
      router.push("/dashboard");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth login
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/users/google-login?token=${credentialResponse.credential}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Google login failed");
        return;
      }

      const data = await res.json();
      localStorage.setItem("user_id",   data.user_id);
      localStorage.setItem("user_name", data.name);
      window.dispatchEvent(new Event("auth-change"));

      // New Google user or incomplete profile → complete profile first
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
            Welcome back to <span className="text-purple-700">NutriSync</span>
          </h1>
          <p className="text-gray-400 text-sm mb-6">Log in to your account</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <input
              name="email"
              type="email"
              placeholder="Email"
              onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              onChange={handleChange}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-400"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-purple-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-800 transition disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google login button */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google login failed")}
                text="signin_with"
                shape="rectangular"
                theme="outline"
                size="large"
              />
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-purple-700 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </GoogleOAuthProvider>
  );
}