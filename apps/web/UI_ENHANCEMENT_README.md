# SprintPulse Web UI Enhancement

Current date: May 12, 2026

## What Is Active

The enhanced UI is active for protected routes through `EnhancedShell`.

The real project dashboard now uses the new component system:

- `MetricCard`
- `HealthGauge`
- `TrendChart`
- `HeatMap`
- `TeamPulseGrid`
- `RiskFlagsList`
- `RecommendationsPanel`
- `ActivityFeed`
- `LiveIndicator`
- `EmptyState`

The dashboard is wired to the existing SprintPulse API data. The old demo-only showcase route was removed so the product flow itself is the source of truth.

## Important CSS Notes

- Tailwind v4 tokens live in `src/styles/globals.css`.
- Older SprintPulse page classes still live in `src/styles/global.css`.
- Both files are required right now because only the dashboard has been migrated to the new component system.
- Tailwind token variables are internally namespaced to avoid collisions with legacy CSS variables.

## Real Entry Points

Use these routes after login:

- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/dashboard`
- `/projects/:projectId/team`
- `/projects/:projectId/sprints`
- `/projects/:projectId/integrations`
- `/projects/:projectId/standups`

There is no `/ui-showcase` route now.

## Keyboard And UI Features

- `Cmd+K` or `Ctrl+K`: open command palette.
- Theme toggle is in the top bar.
- AI assistant is available through the floating sparkle button.
- Dashboard cards animate with Framer Motion and CountUp.

## Verify

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

The large bundle warning is expected until route-level lazy loading is added.
