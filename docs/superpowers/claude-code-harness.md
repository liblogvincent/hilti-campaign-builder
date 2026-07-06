# Claude Code WSL Harness

Use this command from PowerShell/Codex when Claude Code is needed as a bounded implementation worker:

```powershell
wsl -e bash -lc 'cd /mnt/c/Users/tutuclaw/Documents/hilti-campaign-builder && "$HOME/.nvm/versions/node/v24.15.0/bin/claude" -p "<TASK PROMPT>" --output-format text --no-session-persistence'
```

Do not call plain `claude` from non-interactive WSL. It resolves to the Windows npm shim and may use the wrong API account.

Worker rules:
- One task per prompt.
- Name exact files the worker may inspect or edit.
- Do not include secrets.
- Ask Claude to stop after the patch summary.
- Codex reviews `git diff`, runs tests, and decides whether to keep or revise the work.
