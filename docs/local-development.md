# Local Development

## Prerequisites

- Node.js 24 or compatible.
- pnpm 11.

## Install

```powershell
pnpm install
pnpm approve-builds esbuild sharp
```

`esbuild` is used by `tsx`; `sharp` is used by Next.js image/runtime tooling.

## Run

Start the server:

```powershell
pnpm --filter @aic/server start
```

Start the web app:

```powershell
pnpm --filter @aic/web dev
```

If port 3000 is busy during local iteration:

```powershell
$env:PORT = "3002"
pnpm --filter @aic/web dev:any
```

Default URLs:

- Web: `http://localhost:3000`
- Alternate Web: `http://localhost:3002`
- API: `http://127.0.0.1:4317`

## iPhone / LAN Access

By default the API binds to `127.0.0.1`, so it is only reachable from this computer. For same-Wi-Fi phone testing, start the API on all local interfaces:

```powershell
$env:AIC_HOST = "0.0.0.0"
pnpm --filter @aic/server start
```

Then start the web app:

```powershell
pnpm --filter @aic/web dev
```

Open the web app from the phone with the computer's LAN IP, for example:

```text
http://192.168.2.101:3000
```

When `NEXT_PUBLIC_API_BASE_URL` is not set, the web app infers the API host from the page host. Opening `http://192.168.2.101:3000` makes the browser call `http://192.168.2.101:4317`.

Keep LAN exposure limited to trusted Wi-Fi. Do not expose these ports directly to the public internet.

Default bootstrap login:

- Email: `admin@example.local`
- Password: `change-me`

Override these with environment variables from `.env.example` before daily use.

Settings can revoke the current login token with the logout button.

## Agent Adapters

Seeded agents:

- `agt_noop`: built-in no-op adapter for smoke tests.
- `agt_codex`: Codex-compatible process adapter.

Codex process configuration:

```powershell
$env:AIC_CODEX_COMMAND = "codex"
$env:AIC_CODEX_ARGS = ""
```

The Codex adapter starts a child process in the workspace path and persists stdout, stderr, process errors, and process exit messages into session logs. If the CLI is missing, the session records a structured error log instead of pretending to run.

## Runtime Status

Each started session now has a persisted Agent Runtime instance. After creating a session, query it with:

```powershell
curl.exe -H "Authorization: Bearer <token>" http://127.0.0.1:4317/api/sessions/<session-id>/runtime
```

Runtime status values are provider-neutral:

```text
idle | planning | running | waiting | tool_calling | completed | failed | cancelled
```

`heartbeatAt` is updated by the local daemon while the runtime is active. This is the baseline for future recovery and Telegram status views; full process restart/recovery is not implemented yet.

## Telegram Remote Console

Telegram is a Remote Console, not an Agent. It is disabled by default. To enable it, set:

```powershell
$env:AIC_TELEGRAM_BOT_TOKEN = "<bot-token>"
$env:AIC_TELEGRAM_ALLOWED_CHAT_IDS = "<your-chat-id>"
pnpm --filter @aic/server start
```

Supported commands:

```text
/status [sessionId]
/logs [sessionId]
/continue [text]
/pause
/resume
/stop
```

`/continue`, `/pause`, `/resume`, and `/stop` create Command Queue entries with `source = telegram`; Telegram does not directly control Agent Runtime.

## Screenshots

The screenshot runner tries a local Chromium-compatible browser in this order: `AIC_BROWSER_COMMAND`, Microsoft Edge, Google Chrome, then common Linux Chromium command names. Override the browser path when needed:

```powershell
$env:AIC_BROWSER_COMMAND = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Screenshot URLs are limited to local targets such as `http://127.0.0.1:3000`. If the browser cannot capture on the current machine, the server still stores a valid placeholder PNG and writes the unavailable reason into the session log.

## Checks

```powershell
pnpm check
pnpm build
```

Do not keep a Next dev server open on the same `.next` directory while repeatedly running `pnpm build`; restart the dev server afterward if a page returns a webpack runtime error.

## Current Web Flow

- Open Chat.
- Sign in with the bootstrap admin credentials.
- Start a session with `No-op Agent` for smoke tests or `Codex CLI` for a real process-backed adapter.
- Send a command.
- Use the stop button in Chat to call the server session stop API; this is separate from sending a text command to the agent.
- Chat messages render a safe Markdown subset with paragraphs, lists, inline code, and fenced code blocks with lightweight syntax highlighting. HTML is not rendered.
- Chat, Logs, Files, and Screenshots restore the saved session from `GET /api/sessions/:id`; if that saved ID is stale, they fall back to the latest persisted session from `GET /api/sessions`.
- Open Logs to replay persisted logs and receive live `log:line` events for the current session.
- Logs auto-scroll to the newest visible line after refresh, search, or live socket updates.
- The Logs download button fetches the full persisted session log from the server, not only the rows currently visible in the browser.
- Open Files and click Refresh to snapshot Git file changes for the selected session. Non-Git workspaces return an empty list and write a system log with the unavailable reason.
- Open Screenshots and click Capture to create a screenshot artifact for the selected session. Browser capture is attempted first; if it is unavailable on the machine, the artifact falls back to a valid placeholder PNG with a warning in Logs.
- Open Dashboard to view the latest session, real memory usage, structured Git availability, recent file changes, and DB-backed notifications. The bell button creates a test notification.
- Dashboard refreshes automatically every 10 seconds after login.

## PWA

The web app exposes `/manifest.webmanifest`, 192px/512px app icons, and an Apple touch icon. It is ready for browser install testing over localhost or a trusted LAN URL.

## API Tokens

Open Settings to create or revoke local API tokens. Newly created token plaintext is shown once; the server stores only a hash and later lists metadata such as name, creation time, and last-used time.
