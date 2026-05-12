import {
  Activity,
  ArrowRight,
  Gauge,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  ShieldAlert,
  UserPlus,
  Workflow
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/home.css";

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="public-brand" to="/">
          <Activity size={24} />
          <span>SprintPulse AI</span>
        </Link>
        <Link
          aria-label={isAuthenticated ? "Go to projects" : "Login"}
          className="icon-text-button"
          to={isAuthenticated ? "/projects" : "/login"}
        >
          <LockKeyhole size={17} />
          <span>{isAuthenticated ? "Go to projects" : "Login"}</span>
        </Link>
      </nav>

      <section className="public-hero">
        <div className="public-hero-visual" aria-hidden="true">
          <div className="public-product-frame">
            <div className="public-product-sidebar">
              <span />
              <i />
              <i />
              <i />
            </div>
            <div className="public-product-main">
              <div className="public-product-top">
                <span>Semicolon Build Sprint</span>
                <strong>78 health</strong>
              </div>
              <div className="public-product-grid">
                <div>
                  <small>Readiness</small>
                  <strong>67%</strong>
                </div>
                <div>
                  <small>At risk</small>
                  <strong>1</strong>
                </div>
                <div>
                  <small>Flags</small>
                  <strong>5</strong>
                </div>
              </div>
              <div className="public-product-rows">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>

        <div className="public-hero-copy">
          <p className="eyebrow">Predictive sprint intelligence</p>
          <h1>SprintPulse AI</h1>
          <p>
            A clean command center for sprint health, standup risk, Jira movement, and the next action your team should take.
          </p>
          <div className="public-hero-actions">
            <Link className="primary-button" to={isAuthenticated ? "/projects" : "/login"}>
              <ArrowRight size={18} />
              <span>{isAuthenticated ? "Open projects" : "Login to workspace"}</span>
            </Link>
            {isAuthenticated ? (
              <a aria-label="See sprint signals" className="icon-text-button" href="#signals">
                <Gauge size={17} />
                <span>See sprint signals</span>
              </a>
            ) : (
              <Link aria-label="Create account" className="icon-text-button" to="/signup">
                <UserPlus size={17} />
                <span>Create account</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="public-signal-band" id="signals">
        <div>
          <MessageSquareText size={22} />
          <h2>Standups</h2>
          <p>Turn messy updates and transcripts into clear delivery signals.</p>
        </div>
        <div>
          <Workflow size={22} />
          <h2>Jira</h2>
          <p>Keep sprint movement, blockers, and ownership visible in one place.</p>
        </div>
        <div>
          <GitBranch size={22} />
          <h2>Delivery</h2>
          <p>Spot say-do gaps before they become delivery-day surprises.</p>
        </div>
        <div>
          <ShieldAlert size={22} />
          <h2>Risk</h2>
          <p>Rank flags, recommendations, and team attention with a judge-ready view.</p>
        </div>
      </section>
    </main>
  );
}
