import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const router = useRouter();
  const [characterName, setCharacterName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanName = characterName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setError("Enter the player or character name you want shown on the site.");
      return;
    }
    if (cleanName.length > 80) {
      setError("Player names must be 80 characters or fewer.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login?confirmed=1`
        : undefined;

    const { data, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          character_name: cleanName,
        },
        emailRedirectTo,
      },
    });

    setLoading(false);

    if (signupError) {
      setError(signupError.message || "Account creation failed.");
      return;
    }

    if (data?.session) {
      router.replace("/profile?welcome=1");
      return;
    }

    setSubmittedEmail(cleanEmail);
    setPassword("");
    setConfirmPassword("");
  }

  if (submittedEmail) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-7 col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <h1 className="h4 mb-3">Check your email</h1>
                <p className="mb-3">
                  A confirmation link was sent to <strong>{submittedEmail}</strong>.
                  Open that link to activate your player account, then sign in with
                  the password you just created.
                </p>
                <div className="d-grid gap-2">
                  <Link className="btn btn-primary" href="/login">
                    Return to sign in
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSubmittedEmail("")}
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-7 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h1 className="h4 mb-1">Create a player account</h1>
              <p className="text-body-secondary mb-4">
                Choose the name shown to the campaign, then set your email and password.
              </p>

              <form onSubmit={onSubmit} className="d-grid gap-3">
                <div>
                  <label className="form-label" htmlFor="characterName">
                    Player or character name
                  </label>
                  <input
                    id="characterName"
                    type="text"
                    className="form-control"
                    value={characterName}
                    onChange={(event) => setCharacterName(event.target.value)}
                    autoComplete="nickname"
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="signupEmail">Email</label>
                  <input
                    id="signupEmail"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="signupPassword">Password</label>
                  <input
                    id="signupPassword"
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                  <div className="form-text">At least {MIN_PASSWORD_LENGTH} characters.</div>
                </div>

                <div>
                  <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>

                <div className="form-check">
                  <input
                    id="showPassword"
                    type="checkbox"
                    className="form-check-input"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="showPassword">
                    Show password
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Creating account…" : "Create player account"}
                </button>

                {error && <div className="alert alert-danger m-0">{error}</div>}
              </form>

              <hr className="my-4" />
              <p className="mb-0 text-center">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
