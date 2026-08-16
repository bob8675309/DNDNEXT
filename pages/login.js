import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

function safeLocalPath(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        setError(loginError.message || "Login failed.");
        return;
      }

      const requestedPath = safeLocalPath(router.query.next);
      if (requestedPath) {
        setLoading(false);
        void router.replace(requestedPath);
        return;
      }

      // Successful sign-in always enters through the shared Profile host. The
      // characterProfile query is the same authority used by the navbar and
      // causes PlayerCharacterProfilePanelUnified to open immediately for both
      // players and administrators.
      setLoading(false);
      void router.replace("/profile?characterProfile=1");
    } catch (cause) {
      setError(cause?.message || "Login could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h1 className="h4 mb-3">Sign in</h1>

              {router.query.confirmed === "1" && (
                <div className="alert alert-success">
                  Email confirmed. Sign in with the password you created.
                </div>
              )}

              <form onSubmit={onSubmit} className="d-grid gap-3">
                <div>
                  <label className="form-label" htmlFor="loginEmail">Email</label>
                  <input
                    id="loginEmail"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="loginPassword">Password</label>
                  <input
                    id="loginPassword"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Logging in…" : "Login"}
                </button>

                {error && <div className="alert alert-danger m-0">{error}</div>}
              </form>

              <hr className="my-4" />
              <p className="mb-0 text-center">
                New player? <Link href="/signup">Create an account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
