# Figma Remote MCP For Panda

Panda separates two Figma capabilities:

- Figma REST: verifies files and posts Panda mapping comments. This uses `FIGMA_TOKEN`.
- Figma Remote MCP: creates or updates native editable Figma frames/placeholders. This uses `https://mcp.figma.com/mcp` and requires an authenticated MCP/OAuth session.

## Required Vercel Environment

Set these as server-side Vercel environment variables:

```text
FIGMA_TOKEN=...
FIGMA_MCP_URL=https://mcp.figma.com/mcp
FIGMA_MCP_TOOL=generate_figma_design
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PANDA_RUNTIME_MODE=supabase
PANDA_PUBLIC_BASE_URL=https://hilti-campaign-builder.vercel.app
PANDA_APP_URL=https://hilti-campaign-builder.vercel.app
```

Optional server-only migration/admin variable:

```text
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Do not expose `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or MCP tokens to browser code.

## Supabase Storage

Apply:

```text
supabase/migrations/202607080001_integration_connections.sql
```

This creates:

- `integration_connections`: stores the server-side Figma MCP access token/session.
- `integration_oauth_states`: stores short-lived PKCE state during the Figma OAuth redirect.

Phase 1 can also use `FIGMA_MCP_ACCESS_TOKEN` as a prototype-only server-side fallback if an authenticated bearer/session token is available.

## Current Phase 1 Behavior

- `/api/integrations/figma/mcp-status` reports whether remote MCP is configured and authenticated.
- `/api/integrations/figma/connect` starts the Figma MCP OAuth flow.
- `/api/integrations/figma/oauth/callback` exchanges the code and stores the connection in Supabase.
- `/api/integrations/figma/create-board` calls the configured MCP tool only when authenticated.
- Without MCP auth, Panda returns `401` with `capability: "mcp-auth-required"` and still returns the board manifest so the artifact remains useful.

## Next Step

Deploy the app with the Supabase migration and environment variables, then click `Connect Figma MCP` from the Figma Board workspace. The redirect URI should be:

```text
https://hilti-campaign-builder.vercel.app/api/integrations/figma/oauth/callback
```
