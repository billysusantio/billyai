# BillyAI 🤖

A WhatsApp "clone" of **Billy** that his team can chat with, and that sends
**per-role / per-team reminders** on a schedule. Built to run on Railway.

**Stack:** Node.js · [Fonnte](https://fonnte.com) (unofficial WhatsApp API) ·
[Google Gemini](https://ai.google.dev) (2.5 Flash-Lite) · [Railway](https://railway.app)

---

## How it works

```
WhatsApp ──▶ Fonnte ──▶ POST /webhook ──▶ BillyAI (Gemini) ──▶ Fonnte ──▶ WhatsApp
                                   └──▶ reminder scheduler (node-cron) ──▶ Fonnte
```

- **Chat** — a teammate messages the WhatsApp number; Fonnte forwards it to
  `/webhook`; `src/billy.js` asks Gemini for a reply in Billy's voice (with the
  sender's role/team as context) and sends it back via Fonnte.
- **Reminders** — `src/reminders.js` reads `config/reminders.json` and fires each
  reminder on its cron schedule to everyone matching its role/team target.

## Project layout

| Path | Purpose |
|------|---------|
| `src/index.js` | Express server: health check + `/webhook` |
| `src/billy.js` | Gemini-powered persona + reply logic |
| `src/fonnte.js` | Send WhatsApp messages via Fonnte |
| `src/reminders.js` | Cron scheduler for reminders |
| `src/config.js` | Loads team + reminder config |
| `config/teams.example.json` | Who's who (name, phone, role, team) |
| `config/reminders.example.json` | What to send, to whom, when |

## Setup

1. **Install**
   ```bash
   npm install
   cp .env.example .env          # fill in tokens
   cp config/teams.example.json config/teams.json
   cp config/reminders.example.json config/reminders.json
   ```
2. **Get tokens**
   - `FONNTE_TOKEN` — from your Fonnte device dashboard.
   - `GEMINI_API_KEY` — free key from https://aistudio.google.com/apikey
3. **Run locally**
   ```bash
   npm run dev
   ```
4. **Point Fonnte at the webhook** — in the Fonnte device settings, set the
   webhook URL to `https://<your-app>/webhook` (add `?secret=...` if you set
   `WEBHOOK_SECRET`).

## Deploy to Railway

1. Create a new Railway project from this GitHub repo.
2. Add the env vars from `.env.example` in Railway → Variables.
3. Railway auto-detects Node and runs `node src/index.js` (see `railway.json`).
4. Generate a domain (Railway → Settings → Networking) and use
   `https://<domain>/webhook` as the Fonnte webhook URL.

> **Note:** the in-memory chat history and `config/*.json` reset on redeploy.
> For persistence, move config to a database and the history to a Railway volume.

## Config reference

**`config/teams.json`**
```json
{ "members": [ { "name": "Aldo", "phone": "6281234567890", "role": "sales", "team": "growth" } ] }
```

**`config/reminders.json`** — `cron` is standard 5-field syntax in your `TZ`;
`target` filters by `roles` and/or `teams` (empty = everyone):
```json
{ "reminders": [ { "id": "sales-standup", "message": "Top 3 deals today?", "cron": "0 9 * * 1-5", "target": { "roles": ["sales"], "teams": [] } } ] }
```

## TODO (waiting on Billy's backend doc)

- [ ] Replace the placeholder persona (`SYSTEM_PROMPT` in `src/billy.js`) with Billy's real voice/facts.
- [ ] Fill `config/teams.json` and `config/reminders.json` with real data.
- [ ] Persist conversation history + config (DB or Railway volume).
- [ ] Confirm Fonnte webhook payload field names for the device plan in use.
