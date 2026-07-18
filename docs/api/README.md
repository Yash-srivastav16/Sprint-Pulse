# SprintPulse API OpenAPI Contract

`openapi.yaml` is an OpenAPI 3.0.3 contract for the Express API mounted at `/api`.
`index.html` is a static Redoc build for direct local viewing.

## Local Swagger UI

Start the API, then run:

```sh
npm run dev:api
npx swagger-ui-watcher docs/api/openapi.yaml
```

The OpenAPI server is set to `http://localhost:4000/api`, so Swagger's **Try it out** buttons call your local API.

## Import Into SwaggerHub

1. Open SwaggerHub and create a new API.
2. Choose OpenAPI 3.0.
3. Import `docs/api/openapi.yaml` from this repository, or paste the YAML into the SwaggerHub editor.
4. Set the API owner and visibility for the team.
5. Keep the local server URL `http://localhost:4000/api` for development. Add a deployed server URL later when one exists.

## Keeping It Updated

Update this file whenever routes or shared contracts change:

```sh
rg -n "apiRouter\\.(get|post|patch|put|delete)" apps/api/src/routes/index.ts
sed -n '1,570p' packages/shared/src/index.ts
```

Then update `docs/api/openapi.yaml` for any added, removed, or changed paths, request bodies, responses, examples, and error statuses.

Before importing, parse the YAML locally:

```sh
ruby -e 'require "yaml"; YAML.load_file("docs/api/openapi.yaml"); puts "openapi.yaml parsed"'
```

In the hackathon deployment, `/api/*` routes accept either `X-SprintPulse-API-Key` for server-to-server callers such as MCP or `Authorization: Bearer <supabase-jwt>` for browser/user calls. Route payloads still include `personaId` so the API can scope dashboard views and role-aware responses. Several legacy mock-flow routes return `501` in Supabase data mode; keep those documented until the API source removes or replaces them.
