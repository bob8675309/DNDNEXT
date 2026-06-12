import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_PASSWORD_LENGTH = 8;

function fallbackPlayerName(user) {
  const metadataName = String(user?.user_metadata?.character_name || "").trim();
  if (metadataName) return metadataName.slice(0, 80);
  const emailName = String(user?.email || "").split("@")[0].trim();
  return (emailName || "New Player").slice(0, 80);
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("player");
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        router.replace("/login?next=/profile");
        return;
      }

      const currentUser = session.user;
      if (!active) return;
      setUser(currentUser);

      const [{ data: player, error: playerError }, { data: profile }] = await Promise.all([
        supabase
          .from("players")
          .select("id,user_id,name")
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("role")
          .eq("id", currentUser.id)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (playerError) {
        setProfileError(playerError.message || "Could not load the player profile.");
      }

      if (player) {
        setPlayerId(player.id);
        setName(player.name || fallbackPlayerName(currentUser));
      } else {
        const initialName = fallbackPlayerName(currentUser);
        const { data: createdPlayer, error: createError } = await supabase
          .from("players")
          .insert({ user_id: currentUser.id, name: initialName })
          .select("id,user_id,name")
          .single();

        if (!active) return;

        if (createError) {
          setName(initialName);
          setProfileError(createError.message || "Could not create the player profile.");
        } else {
          setPlayerId(createdPlayer.id);
          setName(createdPlayer.name);
        }
      }

      setRole(profile?.role || "player");
      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(event) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setProfileError("Enter a player or character name with at least 2 characters.");
      return;
    }
    if (cleanName.length > 80) {
      setProfileError("Player names must be 80 characters or fewer.");
      return;
    }
    if (!user) {
      setProfileError("Your session has expired. Sign in again.");
      return;
    }

    setProfileSaving(true);

    let query = supabase
      .from("players")
      .update({ name: cleanName, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select("id,name")
      .single();

    if (!playerId) {
      query = supabase
        .from("players")
        .upsert({ user_id: user.id, name: cleanName }, { onConflict: "user_id" })
        .select("id,name")
        .single();
    }

    const { data: savedPlayer, error: saveError } = await query;

    if (saveError) {
      setProfileSaving(false);
      setProfileError(saveError.message || "Could not save the player profile.");
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { character_name: cleanName },
    });

    setPlayerId(savedPlayer.id);
    setName(savedPlayer.name);
    setProfileSaving(false);
    setProfileMessage(
      metadataError
        ? "Profile saved. The account display metadata will update after your next sign-in."
        : "Profile saved."
    );
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message || "Could not update the password.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated.");
  }

  if (loading) {
    return <div className="container py-5">Loading profile…</div>;
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center g-4">
        <div className="col-12 col-lg-7">
          {router.query.welcome === "1" && (
            <div className="alert alert-success">
              Your player account is ready. Review the name below before continuing.
            </div>
          )}

          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                <div>
                  <h1 className="h4 mb-1">Player profile</h1>
                  <p className="text-body-secondary mb-0">
                    This name appears in player lists, inventory tools, and campaign requests.
                  </p>
                </div>
                <span className="badge text-bg-secondary text-capitalize">{role}</span>
              </div>

              <form onSubmit={saveProfile} className="d-grid gap-3">
                <div>
                  <label className="form-label" htmlFor="profileEmail">Email</label>
                  <input
                    id="profileEmail"
                    className="form-control"
                    value={user?.email || ""}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="profileName">
                    Player or character name
                  </label>
                  <input
                    id="profileName"
                    className="form-control"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    required
                  />
                </div>

                <button className="btn btn-primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save profile"}
                </button>

                {profileMessage && <div className="alert alert-success m-0">{profileMessage}</div>}
                {profileError && <div className="alert alert-danger m-0">{profileError}</div>}
              </form>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-1">Change password</h2>
              <p className="text-body-secondary mb-4">
                Choose a new password for this account.
              </p>

              <form onSubmit={changePassword} className="d-grid gap-3">
                <div>
                  <label className="form-label" htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="confirmNewPassword">
                    Confirm new password
                  </label>
                  <input
                    id="confirmNewPassword"
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
                    id="showProfilePassword"
                    type="checkbox"
                    className="form-check-input"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="showProfilePassword">
                    Show password
                  </label>
                </div>

                <button className="btn btn-outline-primary" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? "Updating…" : "Update password"}
                </button>

                {passwordMessage && <div className="alert alert-success m-0">{passwordMessage}</div>}
                {passwordError && <div className="alert alert-danger m-0">{passwordError}</div>}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
