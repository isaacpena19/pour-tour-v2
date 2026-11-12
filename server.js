// Pour Tour — zero-dependency live scoreboard server (Node 18+)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000, PIN = process.env.ADMIN_PIN || 'pour';
const FILE = path.join(process.env.DATA_DIR || __dirname, 'data.json');
let state = { name: 'Pour Tour', pars: Array(18).fill(4), teams: [] };
try { state = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
const clients = new Set();
const gen = () => crypto.randomBytes(3).toString('hex').toUpperCase();
state.teams.forEach(t => { t.key = t.key || gen(); });
const pub = () => ({ ...state, teams: state.teams.map(({ key, ...t }) => t) });

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(state)); } catch (e) { console.error('save failed', e.message); }
  const msg = `data: ${JSON.stringify(pub())}\n\n`;
  clients.forEach(c => c.write(msg));
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/state') return send(res, 200, pub());
  if (url === '/api/whoami' && req.method === 'POST') {
    const { key } = await body(req);
    const t = key && state.teams.find(t => t.key === String(key).trim().toUpperCase());
    return t ? send(res, 200, { teamId: t.id }) : send(res, 404, { error: 'Code not found' });
  }
  if (url === '/api/keys' && req.method === 'POST') {
    const { pin } = await body(req);
    if (pin !== PIN) return send(res, 401, { error: 'Wrong PIN' });
    return send(res, 200, state.teams.map(t => ({ id: t.id, name: t.name, key: t.key })));
  }
  if (url === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(pub())}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    return req.on('close', () => { clearInterval(ping); clients.delete(res); });
  }
  if (url === '/api/score' && req.method === 'POST') {
    const { teamId, hole, strokes, key, pin } = await body(req);
    const t = state.teams.find(t => t.id === teamId);
    if (t && pin !== PIN && !(key && String(key).trim().toUpperCase() === t.key)) return send(res, 401, { error: 'Not your team' });
    const ok = strokes === null || (Number.isInteger(strokes) && strokes >= 1 && strokes <= 20);
    if (!t || !Number.isInteger(hole) || hole < 0 || hole >= state.pars.length || !ok) return send(res, 400, { error: 'Bad score' });
    t.scores[hole] = strokes; save();
    return send(res, 200, { ok: true });
  }
  if (url === '/api/setup' && req.method === 'POST') {
    const b = await body(req);
    if (b.pin !== PIN) return send(res, 401, { error: 'Wrong PIN' });
    const old = new Map(state.teams.map(t => [t.id, t]));
    const pars = (b.pars || state.pars).map(p => Math.min(6, Math.max(3, parseInt(p) || 4)));
    state = {
      name: String(b.name || 'Pour Tour').slice(0, 40), pars,
      teams: (b.teams || []).slice(0, 40).map(t => {
        const prev = old.get(t.id);
        return {
          id: prev ? prev.id : crypto.randomBytes(4).toString('hex'),
          key: prev ? prev.key : gen(),
          name: String(t.name || 'Team').slice(0, 30),
          players: [String(t.players?.[0] || '').slice(0, 24), String(t.players?.[1] || '').slice(0, 24)],
          scores: pars.map((_, i) => (b.reset || !prev ? null : prev.scores[i] ?? null)),
        };
      }),
    };
    save();
    return send(res, 200, pub());
  }
  const file = url === '/' ? 'index.html' : url.slice(1);
  const p = path.join(__dirname, 'public', file);
  if (!p.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('Pour Tour running on', PORT));
