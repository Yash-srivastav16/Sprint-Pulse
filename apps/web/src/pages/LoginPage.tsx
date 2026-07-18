import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Briefcase,
  GitPullRequest,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquareText,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppRole } from "@sprintpulse/shared";
import { useAuth } from "../context/AuthContext";

type AuthMode = "signin" | "create";

const roleOptions: Array<{ value: AppRole; label: string; lens: string; description: string }> = [
  {
    value: "product-owner",
    label: "Product Owner",
    lens: "Team lens",
    description: "Sprint goals, scope movement, and release risk."
  },
  {
    value: "scrum-master",
    label: "Scrum Master",
    lens: "Team lens",
    description: "Blockers, follow-ups, and team readiness."
  },
  {
    value: "engineering-manager",
    label: "Engineering Manager",
    lens: "Delivery lens",
    description: "Review pressure, ownership gaps, and delivery confidence."
  },
  {
    value: "developer",
    label: "Developer",
    lens: "Individual lens",
    description: "Your standups, assigned Jira work, commits, and PRs."
  },
  {
    value: "qa-lead",
    label: "QA Lead",
    lens: "Quality lens",
    description: "Validation readiness, defects, and test-risk signals."
  }
];

const authSignals = [
  { label: "Standups", detail: "Repeated blockers", icon: MessageSquareText },
  { label: "Jira", detail: "Stale committed work", icon: TicketCheck },
  { label: "Git", detail: "Review pressure", icon: GitPullRequest }
];

export function LoginPage() {
  const location = useLocation();
  const inviteParams = new URLSearchParams(location.search);
  const invitedEmail = inviteParams.get("email")?.trim() ?? "";
  const invitedName = inviteParams.get("name")?.trim() ?? "";
  const invitedRole = inviteParams.get("role") as AppRole | null;
  const invitedRoleIsValid = Boolean(invitedRole && roleOptions.some((role) => role.value === invitedRole));
  const isInviteSignup = location.pathname === "/signup" && Boolean(invitedEmail && invitedRoleIsValid);
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
  const selectedRole = roleOptions.find((role) => role.value === appRole) ?? roleOptions[0];
  const inviteRoleLabel = roleOptions.find((role) => role.value === invitedRole)?.label;
  const proofText =
    mode === "signin"
      ? "Jira reports status. SprintPulse explains hidden risk, owner action, and delivery confidence."
      : isInviteSignup
        ? "Invite detected. Your email and role stay locked so SprintPulse can attach the right project access."
        : "Your role sets the default lens. Project access still comes from Team management.";

  useEffect(() => {
    setMode(location.pathname === "/signup" ? "create" : "signin");
    setError(null);
    setSuccess(null);

    if (location.pathname === "/signup" && invitedEmail) {
      setEmail(invitedEmail);
    }
    if (location.pathname === "/signup" && invitedName) {
      setName(invitedName);
    }
    if (location.pathname === "/signup" && invitedRole && invitedRoleIsValid) {
      setAppRole(invitedRole);
    }
  }, [invitedEmail, invitedName, invitedRole, invitedRoleIsValid, location.pathname]);

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

      const response = await signUpWithPassword({
        name,
        email: isInviteSignup ? invitedEmail : email,
        password,
        appRole: isInviteSignup && invitedRole ? invitedRole : appRole
      });
      setPassword("");
      setConfirmPassword("");

      if (response.recommendedRoute) {
        navigate(response.recommendedRoute, { replace: true });
        return;
      }

      setSuccess(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "signin" ? "Sign-in failed" : "Account creation failed");
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
          <p className="eyebrow">SprintPulse AI</p>
          <h1>
            {mode === "signin"
              ? "Jira shows what moved. SprintPulse detects hidden sprint risk."
              : "Create the role-aware layer above Jira."}
          </h1>
          <p className="login-copy-lede">
            {mode === "signin"
              ? "Open the workspace that correlates standups, Jira movement, and Git activity into one sprint-risk model."
              : "Choose the role that matches your demo lens, then land in the project workspace built for your access."}
          </p>

          <div className="login-signal-list" aria-label="SprintPulse signal sources">
            {authSignals.map((signal) => {
              const SignalIcon = signal.icon;

              return (
                <div className="login-signal-item" key={signal.label}>
                  <span className="login-signal-icon">
                    <SignalIcon size={17} />
                  </span>
                  <span>
                    <strong>{signal.label}</strong>
                    <small>{signal.detail}</small>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="login-proof">
            <ShieldCheck size={18} />
            <span>{proofText}</span>
          </div>
        </div>

        <div className="login-auth-column">
          <form className="login-form-card" onSubmit={submit}>
            <div className="segmented-control auth-mode-tabs" role="tablist" aria-label="Authentication mode">
              <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => changeMode("signin")}>
                <span>Sign in</span>
              </button>
              <button className={mode === "create" ? "active" : ""} type="button" onClick={() => changeMode("create")}>
                <span>Create account</span>
              </button>
            </div>

            <div className="auth-form-heading">
              <p className="eyebrow">{mode === "signin" ? "Enterprise access" : "Role-aware setup"}</p>
              <h2>{mode === "signin" ? "Welcome back" : "Create account"}</h2>
            </div>

            {configurationError ? <p className="form-error">{configurationError}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}

            {mode === "create" && isInviteSignup ? (
              <div className="auth-invite-lock">
                <UsersRound size={18} />
                <span>
                  <strong>Project invite matched</strong>
                  {invitedEmail}
                  {inviteRoleLabel ? `, ${inviteRoleLabel}` : ""}
                </span>
              </div>
            ) : null}

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
                  <span>SprintPulse role</span>
                  <div className="input-shell">
                    <Briefcase size={18} />
                    <select
                      value={appRole}
                      onChange={(event) => setAppRole(event.target.value as AppRole)}
                      disabled={Boolean(configurationError) || isInviteSignup}
                      required
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="field-hint role-hint">
                    <strong>{selectedRole.lens}</strong>
                    {selectedRole.description}
                  </p>
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
                  disabled={Boolean(configurationError) || isInviteSignup}
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
              <span>{mode === "signin" ? "Enter workspace" : "Create workspace account"}</span>
            </button>

            {error && error !== configurationError ? <p className="form-error">{error}</p> : null}
            <p className="auth-form-note">
              {mode === "signin"
                ? "Use your project email. SprintPulse resolves project access from your profile."
                : isInviteSignup
                  ? "After signup, SprintPulse opens the workspace tied to this invite."
                  : "Project owners can add this account to project teams from Team management."}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
