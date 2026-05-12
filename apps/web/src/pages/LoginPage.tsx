import { FormEvent, useEffect, useState } from "react";
import { Activity, ArrowRight, Briefcase, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppRole } from "@sprintpulse/shared";
import { useAuth } from "../context/AuthContext";

type AuthMode = "signin" | "create";

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "product-owner", label: "Product Owner" },
  { value: "scrum-master", label: "Scrum Master" },
  { value: "engineering-manager", label: "Engineering Manager" },
  { value: "developer", label: "Developer" },
  { value: "qa-lead", label: "QA Lead" }
];

export function LoginPage() {
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(location.pathname === "/signup" ? "create" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appRole, setAppRole] = useState<AppRole>("developer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { configurationError, isAuthenticated, isLoading, signInWithPassword, signUpWithPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMode(location.pathname === "/signup" ? "create" : "signin");
    setError(null);
    setSuccess(null);

    const params = new URLSearchParams(location.search);
    const invitedEmail = params.get("email");
    const invitedName = params.get("name");
    const invitedRole = params.get("role") as AppRole | null;

    if (location.pathname === "/signup" && invitedEmail) {
      setEmail(invitedEmail);
    }
    if (location.pathname === "/signup" && invitedName) {
      setName(invitedName);
    }
    if (location.pathname === "/signup" && invitedRole && roleOptions.some((role) => role.value === invitedRole)) {
      setAppRole(invitedRole);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/projects", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    navigate(nextMode === "create" ? "/signup" : "/login", { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (configurationError) {
      setError(configurationError);
      return;
    }

    if (mode === "create") {
      if (password.length < 8) {
        setError("Use at least 8 characters for the password.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signin") {
        const response = await signInWithPassword({ email, password });
        navigate(response.recommendedRoute, { replace: true });
        return;
      }

      const response = await signUpWithPassword({ name, email, password, appRole });
      setPassword("");
      setConfirmPassword("");

      if (response.recommendedRoute) {
        navigate(response.recommendedRoute, { replace: true });
        return;
      }

      setSuccess(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "signin" ? "Login failed" : "Account creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel auth-panel">
        <div className="login-copy">
          <div className="brand-mark">
            <Activity size={28} />
          </div>
          <p className="eyebrow">Sprint intelligence workspace</p>
          <h1>{mode === "signin" ? "Access SprintPulse AI" : "Create your SprintPulse account"}</h1>
          <p>
            {mode === "signin"
              ? "Sign in to open your project workspace, sprint dashboard, standups, and delivery signals."
              : "If you were invited, use the same email from the invite. You choose your own password here."}
          </p>
          <div className="login-proof">
            <ShieldCheck size={18} />
            <span>
              {mode === "signin"
                ? "Your project access is loaded from your SprintPulse profile."
                : "SprintPulse verifies project access by matching this signed-in email to pending invites."}
            </span>
          </div>
        </div>

        <form className="login-form-card" onSubmit={submit}>
          <div className="segmented-control auth-mode-tabs" role="tablist" aria-label="Authentication mode">
            <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => changeMode("signin")}>
              <span>Sign in</span>
            </button>
            <button className={mode === "create" ? "active" : ""} type="button" onClick={() => changeMode("create")}>
              <span>Create account</span>
            </button>
          </div>

          <div>
            <p className="eyebrow">{mode === "signin" ? "Secure access" : "New workspace user"}</p>
            <h2>{mode === "signin" ? "Sign in" : "Create account"}</h2>
          </div>

          {configurationError ? <p className="form-error">{configurationError}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}

          {mode === "create" ? (
            <>
              <label className="field-group">
                <span>Full name</span>
                <div className="input-shell">
                  <UserRound size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    disabled={Boolean(configurationError)}
                    required
                  />
                </div>
              </label>

              <label className="field-group">
                <span>Workspace role</span>
                <div className="input-shell">
                  <Briefcase size={18} />
                  <select
                    value={appRole}
                    onChange={(event) => setAppRole(event.target.value as AppRole)}
                    disabled={Boolean(configurationError)}
                    required
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </>
          ) : null}

          <label className="field-group">
            <span>Email</span>
            <div className="input-shell">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                disabled={Boolean(configurationError)}
                required
              />
            </div>
          </label>

          <label className="field-group">
            <span>Password</span>
            <div className="input-shell">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signin" ? "Your password" : "Minimum 8 characters"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={Boolean(configurationError)}
                required
              />
            </div>
          </label>

          {mode === "create" ? (
            <label className="field-group">
              <span>Confirm password</span>
              <div className="input-shell">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  disabled={Boolean(configurationError)}
                  required
                />
              </div>
            </label>
          ) : null}

          <button
            className="primary-button full-width"
            type="submit"
            disabled={submitting || isLoading || Boolean(configurationError)}
          >
            {submitting ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
            <span>{mode === "signin" ? "Sign in to projects" : "Create account"}</span>
          </button>

          {error && error !== configurationError ? <p className="form-error">{error}</p> : null}
          <p className="auth-form-note">
            {mode === "signin"
              ? "New to SprintPulse? Create an account and choose the role you need for this workspace."
              : "Once the account exists, a Scrum Master can add it to any project team from Team management."}
          </p>
        </form>
      </section>
    </main>
  );
}
