# Vercel Durable Runtime Deployment

## Required Environment Variables

```powershell
PANDA_RUNTIME_MODE=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PANDA_AI_TRANSPORT=vercel-ai
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_STYLE=openai
DEEPSEEK_TIMEOUT_MS=20000
```

## Rollout

1. Deploy with `PANDA_RUNTIME_MODE=local` and confirm current demo parity.
2. Run the Supabase migration in the target Supabase project.
3. Seed `camp_04`.
4. Switch the preview deployment to `PANDA_RUNTIME_MODE=supabase`.
5. Verify Home, Campaign Planning, Content Planning, Content, Rollout, Progress, and Runtime Trace.
6. Promote to production only after Vincent approves the preview.

## Safety

H3 remains the publish/spend authorization gate. The durable runtime stores planning and audit state only; it does not publish to live RMB tools.
