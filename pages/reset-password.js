import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message || "Could not verify the password reset link.");
      }
      setReady(Boolean(data?.session));
      setChecking(false);
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message || "Could not update the password.");
        return;
      }
      await supabase.auth.signOut();
      setNewPassword("");
      setConfirmPassword("");
      setComplete(true);
    } catch (cause) {
      setError(cause?.message || "Could not update the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-7 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h1 className="h4 mb-3">Reset password</h1>

              {checking ? (
                <p className="mb-0">Checking your password reset link…</p>
              ) : complete ? (
                <div className="d-grid gap-3">
                  <div className="alert alert-success m-0">
                    Your password has been updated. Sign in with your new password.
                  </div>
                  <Link className="btn btn-primary" href="/login">Return to sign in</Link>
                </div>
              ) : ready ? (
                <form onSubmit={onSubmit} className="d-grid gap-3">
                  <div>
                    <label className="form-label" htmlFor="resetPassword">New password</label>
                    <input
                      id="resetPassword"
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                    <div className="form-text">At least {MIN_PASSWORD_LENGTH} characters.</div>
                  </div>

                  <div>
                    <label className="form-label" htmlFor="resetPasswordConfirm">Confirm password</label>
                    <input
                      id="resetPasswordConfirm"
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
                      id="showResetPassword"
                      type="checkbox"
                      className="form-check-input"
                      checked={showPassword}
                      onChange={(event) => setShowPassword(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="showResetPassword">Show password</label>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Updating password…" : "Update password"}
                  </button>
                  {error && <div className="alert alert-danger m-0">{error}</div>}
                </form>
              ) : (
                <div className="d-grid gap-3">
                  <div className="alert alert-warning m-0">
                    This password reset link is missing, expired, or has already been used. Request a new reset email from the sign-in screen.
                  </div>
                  {error && <div className="alert alert-danger m-0">{error}</div>}
                  <Link className="btn btn-outline-primary" href="/login">Return to sign in</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
