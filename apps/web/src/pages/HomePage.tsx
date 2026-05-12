import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock3,
  Gauge,
  GitBranch,
  GitPullRequest,
  LockKeyhole,
  MessageSquareText,
  Radar,
  ShieldAlert,
  Sparkles,
  TicketCheck,
  TimerReset,
  UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { useAuth } from "../context/AuthContext";
import "../styles/home.css";

const dashboardSignals = [
  {
    id: "health",
    label: "Health",
    value: "78",
    status: "Watch",
    title: "Health is recoverable, but risk is rising.",
    detail: "SprintPulse sees repeated blocker language, stale Jira movement, and a growing review queue in one sprint.",
    action: "Protect QA start",
    owner: "Scrum Master",
    due: "Today",
    confidence: "91%",
    icon: Gauge
  },
  {
    id: "standup",
    label: "Standup",
    value: "2",
    status: "Repeated blockers",
    title: "Same dependency is now mentioned twice.",
    detail: "Two updates point at the API contract, so the system treats this as a recurring blocker instead of a one-off note.",
    action: "Escalate API owner",
    owner: "Yash",
    due: "Next standup",
    confidence: "88%",
    icon: MessageSquareText
  },
  {
    id: "jira",
    label: "Jira",
    value: "4",
    status: "Committed stale",
    title: "Committed sprint issues have not moved.",
    detail: "Four tickets stayed in the same state while the sprint goal still depends on them moving before QA.",
    action: "Split ticket scope",
    owner: "Product Owner",
    due: "Before EOD",
    confidence: "84%",
    icon: TicketCheck
  },
  {
    id: "git",
    label: "Git",
    value: "3",
    status: "PRs waiting",
    title: "Review queue is delaying delivery proof.",
    detail: "Open PRs are building up while Jira still shows committed work, so SprintPulse flags review pressure.",
    action: "Start review swarm",
    owner: "Atharv",
    due: "2 hours",
    confidence: "86%",
    icon: GitPullRequest
  }
] as const;

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [activeSignalId, setActiveSignalId] = useState<(typeof dashboardSignals)[number]["id"]>("health");
  const activeSignal = dashboardSignals.find((signal) => signal.id === activeSignalId) ?? dashboardSignals[0];
  const ActiveSignalIcon = activeSignal.icon;

  return (
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="public-brand" to="/">
          <span className="public-brand-mark">
            <Activity size={24} />
          </span>
          <span>SprintPulse AI</span>
        </Link>

        <div className="public-nav-actions">
          <div className="public-theme-toggle rounded-lg border border-slate-200/70 bg-white/80 shadow-sm transition-colors dark:!border-white/15 dark:!bg-slate-900/80">
            <ThemeToggle />
          </div>
          {!isAuthenticated ? (
            <Link
              aria-label="Create account"
              className="public-nav-link dark:!border-white/15 dark:!bg-slate-900/80 dark:!text-white"
              to="/signup"
            >
              <UserPlus size={17} />
              <span>Create account</span>
            </Link>
          ) : null}
          <Link
            aria-label={isAuthenticated ? "Go to projects" : "Login"}
            className="icon-text-button dark:!border-white/15 dark:!bg-slate-900/80 dark:!text-white"
            to={isAuthenticated ? "/projects" : "/login"}
          >
            <LockKeyhole size={17} />
            <span>{isAuthenticated ? "Go to projects" : "Login"}</span>
          </Link>
        </div>
      </nav>

      <section className="public-hero" aria-labelledby="home-hero-title">
        <div className="public-hero-copy">
          <p className="eyebrow">
            <Sparkles size={16} />
            Predictive sprint intelligence
          </p>
          <h1 id="home-hero-title">Catch sprint risk while there is still time to fix it.</h1>
          <p className="public-hero-lede">
            SprintPulse turns standup updates, Jira movement, and Git activity into one living health model, so teams
            see blockers and say-do gaps before sprint-end surprises.
          </p>

          <div className="public-hero-actions">
            <Link className="primary-button" to={isAuthenticated ? "/projects" : "/login"}>
              <ArrowRight size={18} />
              <span>{isAuthenticated ? "Open projects" : "Login to workspace"}</span>
            </Link>
            {isAuthenticated ? (
              <a aria-label="View live pulse" className="icon-text-button" href="#live-pulse">
                <BarChart3 size={17} />
                <span>View live pulse</span>
              </a>
            ) : (
              <Link aria-label="Create account" className="icon-text-button" to="/signup">
                <UserPlus size={17} />
                <span>Create account</span>
              </Link>
            )}
          </div>

          <div className="public-hero-equation" aria-label="How SprintPulse creates a recommendation">
            <div>
              <MessageSquareText size={18} />
              <strong>Standup says blocked</strong>
              <span>Human signal</span>
            </div>
            <b>+</b>
            <div>
              <TicketCheck size={18} />
              <strong>Jira is not moving</strong>
              <span>Planning signal</span>
            </div>
            <b>+</b>
            <div>
              <GitPullRequest size={18} />
              <strong>PR queue is growing</strong>
              <span>Delivery signal</span>
            </div>
            <b>=</b>
            <div className="result">
              <ShieldAlert size={18} />
              <strong>Risk + owner action</strong>
              <span>What the team should do now</span>
            </div>
          </div>
        </div>

        <div className="public-hero-visual" aria-label="SprintPulse product preview">
          <div className="public-product-frame">
            <div className="public-product-chrome">
              <div className="public-window-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>SprintPulse Command Center</strong>
              <span className="public-live-chip">
                <span />
                Live scan
              </span>
            </div>

            <div className="public-product-shell">
              <aside className="public-product-sidebar" aria-label="Preview navigation">
                <span className="active">
                  <Gauge size={18} />
                </span>
                <span>
                  <MessageSquareText size={18} />
                </span>
                <span>
                  <TicketCheck size={18} />
                </span>
                <span>
                  <GitBranch size={18} />
                </span>
              </aside>

              <div className="public-product-main">
                <div className="public-product-top">
                  <div>
                    <small>Current sprint</small>
                    <strong>78 health</strong>
                  </div>
                  <span>Risk surfaced 36h earlier</span>
                </div>

                <div className="public-product-grid">
                  <div className="public-score-card">
                    <div className="public-score-ring" aria-hidden="true">
                      <span>78</span>
                    </div>
                    <p>Team health</p>
                    <small>Readiness dipped after blocker mentions repeated.</small>
                  </div>

                  <div className="public-signal-stack">
                    <div className="public-signal-row teal">
                      <MessageSquareText size={17} />
                      <span>Standup</span>
                      <strong>2 blocker notes</strong>
                    </div>
                    <div className="public-signal-row amber">
                      <TicketCheck size={17} />
                      <span>Jira</span>
                      <strong>4 tickets aging</strong>
                    </div>
                    <div className="public-signal-row blue">
                      <GitPullRequest size={17} />
                      <span>Git</span>
                      <strong>3 PRs waiting</strong>
                    </div>
                  </div>
                </div>

                <div className="public-risk-board" aria-label="Risk correlation preview">
                  <div className="public-risk-column standup">
                    <span>Standup</span>
                    <strong>Dependency still unclear</strong>
                    <small>Repeated blocker language</small>
                  </div>
                  <div className="public-risk-column jira">
                    <span>Jira</span>
                    <strong>Status has not moved</strong>
                    <small>Scope remains committed</small>
                  </div>
                  <div className="public-risk-column git">
                    <span>Git</span>
                    <strong>Review queue is growing</strong>
                    <small>Delivery activity is delayed</small>
                  </div>
                </div>

                <div className="public-alert-panel">
                  <div>
                    <AlertTriangle size={18} />
                    <span className="public-alert-copy">
                      <strong>High-confidence delivery risk</strong>
                      <span>Escalate API dependency and split QA path before sprint review.</span>
                    </span>
                  </div>
                  <span className="public-preview-action">Review recommendation</span>
                </div>
              </div>
            </div>
          </div>

          <div className="public-float-card one">
            <TimerReset size={18} />
            <span>Before sprint-end</span>
          </div>
          <div className="public-float-card two">
            <Radar size={18} />
            <span>Risk confidence rising</span>
          </div>
        </div>

      </section>

      <section className="public-demo-map" id="signals" aria-label="How SprintPulse works inside a project">
        <div className="public-section-heading">
          <p className="eyebrow">
            <Radar size={16} />
            Project scoped intelligence
          </p>
          <h2>From daily updates to a clear sprint decision.</h2>
          <p>
            Every signal belongs to one project and one sprint. SprintPulse reads the team update, compares it with Jira
            and Git movement, then explains the delivery risk in plain language.
          </p>
        </div>

        <div className="public-demo-flow">
          <article className="public-flow-card">
            <span className="public-flow-index">01</span>
            <MessageSquareText size={22} />
            <h3>Standup update</h3>
            <p>Developer writes what changed, what is next, and whether anything is blocked.</p>
            <strong>Example: API contract is still not final.</strong>
          </article>
          <article className="public-flow-card">
            <span className="public-flow-index">02</span>
            <TicketCheck size={22} />
            <h3>Jira sprint state</h3>
            <p>SprintPulse checks if assigned work is moving or stuck in the same status.</p>
            <strong>Example: 4 committed issues have not moved.</strong>
          </article>
          <article className="public-flow-card">
            <span className="public-flow-index">03</span>
            <GitPullRequest size={22} />
            <h3>Git delivery proof</h3>
            <p>Commits and PRs show whether code is flowing toward review and QA.</p>
            <strong>Example: 3 PRs are waiting for review.</strong>
          </article>
          <article className="public-flow-card public-flow-card-alert">
            <span className="public-flow-index">04</span>
            <ShieldAlert size={22} />
            <h3>Actionable risk</h3>
            <p>The app combines the signals and tells the team what to do next.</p>
            <strong>Action: Escalate dependency before QA slips.</strong>
          </article>
        </div>
      </section>

      <section className="public-pulse-section" id="live-pulse">
        <div className="public-section-heading">
          <p className="eyebrow">
            <BarChart3 size={16} />
            Clean project dashboard
          </p>
          <h2>A sprint view that explains the score without making people hunt.</h2>
          <p>
            The dashboard keeps the demo story simple: current health, the signals behind it, the next action, and the
            people who need attention.
          </p>
        </div>

        <div className="public-dashboard-preview" aria-label="SprintPulse dashboard preview">
          <span className="public-dashboard-glow one" aria-hidden="true" />
          <span className="public-dashboard-glow two" aria-hidden="true" />
          <span className="public-dashboard-scan-line" aria-hidden="true" />

          <div className="public-dashboard-topbar">
            <div>
              <span>Semicolon Build Sprint</span>
              <strong>SprintPulse Dashboard</strong>
            </div>
            <em>
              <span />
              Live project
            </em>
          </div>

          <div className="public-dashboard-kpis" aria-label="Dashboard key metrics">
            {dashboardSignals.map((signal) => {
              const SignalIcon = signal.icon;
              const isActive = signal.id === activeSignal.id;

              return (
                <button
                  className={isActive ? "active" : ""}
                  key={signal.id}
                  type="button"
                  onClick={() => setActiveSignalId(signal.id)}
                >
                  <span>
                    <SignalIcon size={16} />
                    {signal.label}
                  </span>
                  <strong>{signal.value}</strong>
                  <small>{signal.status}</small>
                </button>
              );
            })}
          </div>

          <div className="public-dashboard-body">
            <article className="public-dashboard-main-card">
              <div className="public-dashboard-card-heading">
                <span>Project health</span>
                <strong>Why the score is 78</strong>
              </div>
              <div className="public-dashboard-health-row">
                <div className="public-score-ring" aria-hidden="true">
                  <span>78</span>
                </div>
                <div className="public-health-summary">
                  <b>{activeSignal.status}</b>
                  <h3>
                    <ActiveSignalIcon size={18} />
                    {activeSignal.title}
                  </h3>
                  <p>{activeSignal.detail}</p>
                  <div className="public-health-wave" aria-hidden="true">
                    <i style={{ height: "54%" }} />
                    <i style={{ height: "66%" }} />
                    <i className="warning" style={{ height: "48%" }} />
                    <i style={{ height: "72%" }} />
                    <i className="risk" style={{ height: "38%" }} />
                    <i style={{ height: "78%" }} />
                    <i style={{ height: "58%" }} />
                  </div>
                </div>
              </div>

              <div className="public-dashboard-reason-list">
                <button
                  className={activeSignal.id === "standup" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveSignalId("standup")}
                >
                  <MessageSquareText size={17} />
                  <span>Standup</span>
                  <strong>Same blocker mentioned twice</strong>
                </button>
                <button
                  className={activeSignal.id === "jira" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveSignalId("jira")}
                >
                  <TicketCheck size={17} />
                  <span>Jira</span>
                  <strong>4 committed issues have not moved</strong>
                </button>
                <button
                  className={activeSignal.id === "git" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveSignalId("git")}
                >
                  <GitPullRequest size={17} />
                  <span>Git</span>
                  <strong>3 PRs waiting for review</strong>
                </button>
              </div>
            </article>

            <aside className="public-dashboard-side">
              <article className="public-dashboard-action-card">
                <div className="public-dashboard-card-heading">
                  <span>Recommended action</span>
                  <strong>{activeSignal.action}</strong>
                </div>
                <p>{activeSignal.detail}</p>
                <div className="public-dashboard-action-meta">
                  <span>
                    <b>Owner</b>
                    {activeSignal.owner}
                  </span>
                  <span>
                    <b>Due</b>
                    {activeSignal.due}
                  </span>
                  <span>
                    <b>Confidence</b>
                    {activeSignal.confidence}
                  </span>
                </div>
              </article>

              <article className="public-dashboard-team-card">
                <div className="public-dashboard-card-heading">
                  <span>Team pulse</span>
                  <strong>Who needs attention</strong>
                </div>
                <div className="public-dashboard-member-list">
                  <span>
                    <b>Yash</b>
                    <em>{activeSignal.id === "standup" ? "Dependency owner" : "Blocked"}</em>
                    <strong className="risk">Risk</strong>
                  </span>
                  <span>
                    <b>Yanshi</b>
                    <em>{activeSignal.id === "jira" ? "Ticket stale" : "12h stale"}</em>
                    <strong className="watch">Check</strong>
                  </span>
                  <span>
                    <b>Atharv</b>
                    <em>{activeSignal.id === "git" ? "Review owner" : "Updated"}</em>
                    <strong className="ok">Clear</strong>
                  </span>
                </div>
              </article>
            </aside>
          </div>
        </div>
      </section>

      <section className="public-proof-section" aria-label="SprintPulse impact preview">
        <div className="public-proof-copy">
          <p className="eyebrow">
            <Radar size={16} />
            Role aware by design
          </p>
          <h2>Each person sees the part of the sprint they can act on.</h2>
          <p>
            Product owners see portfolio health. Scrum Masters configure projects and sync tools. Developers submit
            standups and see their own pulse. Every signal stays attached to the selected project and sprint.
          </p>
        </div>

        <div className="public-insight-panel">
          <div className="public-insight-header">
            <span>Demo roles</span>
            <strong>Same data, different permissions</strong>
          </div>
          <div className="public-insight-row critical">
            <AlertTriangle size={18} />
            <div>
              <strong>Product Owner</strong>
              <span>Sees project health, sprint risk, recommendations, and team readiness across projects.</span>
            </div>
            <b>View</b>
          </div>
          <div className="public-insight-row warning">
            <Clock3 size={18} />
            <div>
              <strong>Scrum Master</strong>
              <span>Creates projects, connects Jira/Git, manages team members, and acts on blockers.</span>
            </div>
            <b>Own</b>
          </div>
          <div className="public-insight-row calm">
            <BarChart3 size={18} />
            <div>
              <strong>Developer</strong>
              <span>Submits standups, sees assigned work, and gets a personal pulse without admin controls.</span>
            </div>
            <b>Update</b>
          </div>
        </div>
      </section>
    </main>
  );
}
