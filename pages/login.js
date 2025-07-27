// /pages/login.js

import { useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // On success, redirect to home or dashboard
    router.replace("/");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#191d24]">
      <form
        onSubmit={handleLogin}
        className="bg-[#23272f] p-8 rounded-2xl shadow-2xl w-80 flex flex-col gap-4 border border-gray-800"
      >
        <h1 className="text-xl text-gray-100 font-bold text-center mb-2">Login</h1>
        <input
          type="email"
          className="rounded p-3 border border-gray-700 bg-gray-800 text-gray-100"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          className="rounded p-3 border border-gray-700 bg-gray-800 text-gray-100"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded py-2 font-bold hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div className="text-red-400 text-center">{error}</div>}
      </form>
    </div>
  );
}
