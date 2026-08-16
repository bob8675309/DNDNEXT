import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

function fallbackPlayerName(user) {
  const metadataName = String(user?.user_metadata?.character_name || "").trim();
  if (metadataName) return metadataName.slice(0, 80);
  const emailName = String(user?.email || "").split("@")[0].trim();
  return (emailName || "New Player").slice(0, 80);
}

export default function PlayerAccountPanel({ sessionUser = null, onNameSaved = null }) {
  const [user, setUser] = useState(sessionUser);
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

    async function loadAccount() {
      setLoading(true);
      setProfileError("");
      let currentUser = sessionUser;
      if (!currentUser) {
        const { data } = await supabase.auth.getSession();
        currentUser = data?.session?.user || null;
      }

      if (!active) return;
      if (!currentUser) {
        setUser(null);
        setProfileError("Your session has expired. Sign in again.");
        setLoading(false);
        return;
      }

      setUser(currentUser);
      const [{ data: player, error: playerError }, { data: profile }] = await Promise.all([
        supabase.from("players").select("id,user_id,name").eq("user_id", currentUser.id).maybeSingle(),
        supabase.from("user_profiles").select("role").eq("id", currentUser.id).maybeSingle(),
      ]);

      if (!active) return;
      if (playerError) setProfileError(playerError.message || "Could not load the player profile.");

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

    void loadAccount();
    return () => { active = false; };
  }, [sessionUser]);

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

    const { error: metadataError } = await supabase.auth.updateUser({ data: { character_name: cleanName } });
    setPlayerId(savedPlayer.id);
    setName(savedPlayer.name);
    setProfileSaving(false);
    setProfileMessage(metadataError ? "Profile saved. The account display metadata will update after your next sign-in." : "Profile saved.");
    onNameSaved?.(savedPlayer.name);
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

  if (loading) return <div className="player-account-panel"><div className="text-muted">Loading account…</div></div>;

  return (
    <div className="player-account-panel">
      <div className="player-account-panel__heading">
        <div>
          <div className="player-account-panel__kicker">Account</div>
          <h2>Player profile</h2>
          <p>This name appears in player lists, inventory tools, and campaign requests.</p>
        </div>
        <span className="badge text-bg-secondary text-capitalize">{role}</span>
      </div>

      <div className="player-account-panel__grid">
        <section className="player-account-panel__card">
          <h3>Profile</h3>
          <form onSubmit={saveProfile} className="d-grid gap-3">
            <div>
              <label className="form-label" htmlFor="panelProfileEmail">Email</label>
              <input id="panelProfileEmail" className="form-control" value={user?.email || ""} readOnly disabled />
            </div>
            <div>
              <label className="form-label" htmlFor="panelProfileName">Player or character name</label>
              <input id="panelProfileName" className="form-control" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button>
            {profileMessage ? <div className="alert alert-success m-0 py-2">{profileMessage}</div> : null}
            {profileError ? <div className="alert alert-danger m-0 py-2">{profileError}</div> : null}
          </form>
        </section>

        <section className="player-account-panel__card">
          <h3>Change password</h3>
          <p className="text-muted">Choose a new password for this account.</p>
          <form onSubmit={changePassword} className="d-grid gap-3">
            <div>
              <label className="form-label" htmlFor="panelNewPassword">New password</label>
              <input id="panelNewPassword" type={showPassword ? "text" : "password"} className="form-control" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
            </div>
            <div>
              <label className="form-label" htmlFor="panelConfirmNewPassword">Confirm new password</label>
              <input id="panelConfirmNewPassword" type={showPassword ? "text" : "password"} className="form-control" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
            </div>
            <div className="form-check">
              <input id="panelShowPassword" type="checkbox" className="form-check-input" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
              <label className="form-check-label" htmlFor="panelShowPassword">Show password</label>
            </div>
            <button className="btn btn-outline-primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating…" : "Update password"}</button>
            {passwordMessage ? <div className="alert alert-success m-0 py-2">{passwordMessage}</div> : null}
            {passwordError ? <div className="alert alert-danger m-0 py-2">{passwordError}</div> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
