# SprintPulse UI Testing Checklist

Current date: May 12, 2026

## Build Checks

- [x] `npm run typecheck -w apps/web`
- [x] `npm run build -w apps/web`
- [x] Tailwind v4 token utilities compile.
- [x] Legacy app CSS and new Tailwind CSS both load.
- [x] No stale `/ui-showcase` route remains.

## Render Checks

- [x] `/` renders on mobile without horizontal overflow.
- [x] `/login` renders on mobile without horizontal overflow.
- [x] `/projects` redirects unauthenticated users to `/login`.
- [ ] Authenticated `/projects/:projectId/dashboard` visual check with a real Supabase session.
- [ ] Authenticated project workspace/team/sprints/integrations checks.

## Dashboard Checks

- [ ] Metric cards animate and show real dashboard values.
- [ ] Health gauge renders team and personal health.
- [ ] Team pulse cards link to member detail.
- [ ] Risk flags use current project/persona data.
- [ ] Recommendations use current API response data.
- [ ] Activity feed uses standup, risk, and Git signals.
- [ ] Empty states appear when a project has no activity yet.

## Interactive Checks

- [ ] Command palette opens with `Cmd+K` or `Ctrl+K`.
- [ ] Command palette routes to project-scoped pages.
- [ ] AI assistant opens from the floating button.
- [ ] AI assistant does not show fake user names or fixed fake metrics.
- [ ] Theme toggle works and persists.

## Responsive Checks

- [x] Public home mobile width does not overflow.
- [x] Login mobile width does not overflow.
- [ ] Protected dashboard desktop layout.
- [ ] Protected dashboard tablet layout.
- [ ] Protected dashboard mobile layout.

## Known Follow-Up

- The protected shell still needs a polished mobile navigation pattern.
- The Vite bundle warning remains until route-level code splitting is added.
