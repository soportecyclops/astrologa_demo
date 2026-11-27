// Backend mínimo del turnero: Express + archivo JSON (data/db.json).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(root, 'content');
const DB = path.join(root, 'data', 'db.json');
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'astro-demo';
const OFFSET_MIN = -180; // Buenos Aires, UTC-3 sin horario de verano

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const loadDb = () => readJson(DB, { bookings: [], blocks: [] });
const saveDb = (db) => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(db, null, 2)); };
const servicios = () => readJson(path.join(CONTENT, 'servicios.json'), []);
const horarios = () => readJson(path.join(CONTENT, 'horarios.json'), { paso: 30, anticipacionHoras: 12, diasHaciaAdelante: 60, semana: {} });

const toMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const nowLocal = () => new Date(Date.now() + OFFSET_MIN * 60000); // usar getUTC*
const ymd = (d) => d.toISOString().slice(0, 10);
const dow = (fecha) => new Date(fecha + 'T00:00:00Z').getUTCDay();
const esc = (s) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 300);

function slotsDelDia(fecha, duracion, db = loadDb()) {
  const h = horarios();
  const ventanas = h.semana[String(dow(fecha))] || [];
  const ahora = nowLocal();
  const minAhora = Math.floor(ahora.getTime() / 60000) + h.anticipacionHoras * 60; // minutos desde epoch local
  const base = Date.parse(fecha + 'T00:00:00Z') / 60000;
  const ocupados = [
    ...db.bookings.filter((b) => b.fecha === fecha && b.estado !== 'cancelado').map((b) => [toMin(b.hora), toMin(b.hora) + b.duracion]),
    ...db.blocks.filter((b) => fecha >= b.desde && fecha <= (b.hasta || b.desde)).map((b) => (b.horaDesde ? [toMin(b.horaDesde), toMin(b.horaHasta || '23:59')] : [0, 1440])),
  ];
  const out = [];
  for (const [ini, fin] of ventanas) {
    for (let m = toMin(ini); m + duracion <= toMin(fin); m += h.paso) {
      if (base + m < minAhora) continue;
      if (ocupados.some(([a, b]) => m < b && m + duracion > a)) continue;
      out.push(toHHMM(m));
    }
  }
  return out;
}

const app = express();
app.use(express.json({ limit: '50kb' }));

const hits = new Map();
app.use('/api/bookings', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const k = req.ip, n = (hits.get(k) || []).filter((t) => Date.now() - t < 600000);
  if (n.length >= 8) return res.status(429).json({ error: 'Demasiados intentos. Probá más tarde.' });
  n.push(Date.now()); hits.set(k, n); next();
});

app.get('/api/availability', (req, res) => {
  const s = servicios().find((x) => x.id === req.query.servicio);
  const fecha = String(req.query.fecha || '');
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Parámetros inválidos' });
  res.json({ slots: slotsDelDia(fecha, s.duracion) });
});

app.get('/api/month', (req, res) => {
  const s = servicios().find((x) => x.id === req.query.servicio);
  const mes = String(req.query.mes || '');
  if (!s || !/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: 'Parámetros inválidos' });
  const db = loadDb();
  const dias = {};
  const d = new Date(mes + '-01T00:00:00Z');
  while (d.toISOString().slice(0, 7) === mes) {
    const f = ymd(d);
    dias[f] = slotsDelDia(f, s.duracion, db).length;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  res.json({ dias, maxDias: horarios().diasHaciaAdelante });
});

app.post('/api/bookings', (req, res) => {
  const b = req.body || {};
  const s = servicios().find((x) => x.id === b.servicio);
  if (!s) return res.status(400).json({ error: 'Servicio inexistente' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha) || !/^\d{2}:\d{2}$/.test(b.hora)) return res.status(400).json({ error: 'Fecha u hora inválidas' });
  const nombre = esc(b.nombre), email = esc(b.email), telefono = esc(b.telefono);
  if (nombre.length < 2) return res.status(400).json({ error: 'Ingresá tu nombre' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (telefono.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Teléfono inválido' });
  const db = loadDb();
  if (!slotsDelDia(b.fecha, s.duracion, db).includes(b.hora)) return res.status(409).json({ error: 'Ese horario ya no está disponible. Elegí otro.' });
  const turno = {
    id: crypto.randomUUID().slice(0, 8), creado: new Date().toISOString(), estado: 'confirmado',
    servicio: s.id, servicioNombre: s.nombre, duracion: s.duracion, precio: s.precio, fecha: b.fecha, hora: b.hora,
    nombre, email, telefono, mensaje: esc(b.mensaje),
    nacimiento: { fecha: esc(b.nacimiento?.fecha), hora: esc(b.nacimiento?.hora), lugar: esc(b.nacimiento?.lugar) },
  };
  db.bookings.push(turno);
  saveDb(db);
  res.status(201).json({ turno });
});

// ---- Admin ----
const auth = (req, res, next) => {
  const t = String(req.get('x-admin-token') || '');
  const ok = t.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(ADMIN_PASSWORD));
  return ok ? next() : res.status(401).json({ error: 'No autorizado' });
};
app.get('/api/admin/ping', auth, (_q, r) => r.json({ ok: true }));
app.get('/api/admin/bookings', auth, (_q, r) => r.json(loadDb().bookings.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))));
app.post('/api/admin/bookings/:id/cancel', auth, (req, res) => {
  const db = loadDb(); const t = db.bookings.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'No existe' });
  t.estado = 'cancelado'; saveDb(db); res.json({ ok: true });
});
app.get('/api/admin/blocks', auth, (_q, r) => r.json(loadDb().blocks));
app.post('/api/admin/blocks', auth, (req, res) => {
  const { desde, hasta, horaDesde, horaHasta, motivo } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return res.status(400).json({ error: 'Fecha inválida' });
  const db = loadDb(); const blk = { id: crypto.randomUUID().slice(0, 8), desde, hasta: hasta || desde, horaDesde: horaDesde || '', horaHasta: horaHasta || '', motivo: esc(motivo) };
  db.blocks.push(blk); saveDb(db); res.status(201).json(blk);
});
app.delete('/api/admin/blocks/:id', auth, (req, res) => { const db = loadDb(); db.blocks = db.blocks.filter((b) => b.id !== req.params.id); saveDb(db); res.json({ ok: true }); });
app.get('/api/admin/horarios', auth, (_q, r) => r.json(horarios()));
app.put('/api/admin/horarios', auth, (req, res) => {
  const h = req.body;
  if (!h || typeof h.semana !== 'object' || !Number(h.paso)) return res.status(400).json({ error: 'Formato inválido' });
  fs.writeFileSync(path.join(CONTENT, 'horarios.json'), JSON.stringify(h, null, 2)); res.json({ ok: true });
});

// En producción sirve el build
const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); }

app.listen(PORT, () => console.log(`API del turnero en http://localhost:${PORT} (clave admin: ${process.env.ADMIN_PASSWORD ? '[definida por entorno]' : 'astro-demo'})`));
