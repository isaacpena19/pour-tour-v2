# Pour Tour – live scoreboard

Zero-dependency Node app (no `npm install` needed).

## Deploy on Render
1. Push this folder to a GitHub repo.
2. Render → New → Web Service → pick the repo.
3. Runtime: Node. Build command: *(blank)*. Start command: `node server.js`.
4. Environment → add `ADMIN_PIN` (your secret PIN for the Setup tab).
5. Deploy. Share the URL with the group.

(`render.yaml` is included if you prefer Blueprints.)

## Keeping scores
Scores save to `data.json`. On Render's free tier the disk is wiped on every redeploy/restart,
so for a tournament weekend: don't redeploy mid-event, or add a Render Disk (paid) mounted at
`/data` and set `DATA_DIR=/data`. Free services also sleep after ~15 min idle (first load takes ~30s).
