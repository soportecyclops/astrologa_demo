const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
let token = sessionStorage.getItem('admin') || '';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch('/api/admin' + path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-token': token, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
}
const say = (t: string, err = false) => { const m = $('#msg'); m.textContent = t; m.className = err ? 'err' : 'msg'; };

async function turnos() {
  const list = await api('/bookings');
  $('#t-turnos').innerHTML = `<h2>Turnos</h2><table><thead><tr><th>Fecha</th><th>Sesión</th><th>Persona</th><th>Nacimiento</th><th>Estado</th><th></th></tr></thead><tbody>${list.map((t: any) => `<tr class="${t.estado === 'cancelado' ? 'off' : ''}"><td>${esc(t.fecha)} ${esc(t.hora)}</td><td>${esc(t.servicioNombre)}<br><small>${t.duracion} min</small></td><td>${esc(t.nombre)}<br><small>${esc(t.email)} · <a style="color:#d4af37" href="https://wa.me/${esc(t.telefono.replace(/\D/g, ''))}">${esc(t.telefono)}</a></small></td><td>${esc(t.nacimiento?.fecha)} ${esc(t.nacimiento?.hora)}<br><small>${esc(t.nacimiento?.lugar)}</small></td><td>${esc(t.estado)}</td><td>${t.estado !== 'cancelado' ? `<button data-cancel="${esc(t.id)}">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Todavía no hay turnos.</td></tr>'}</tbody></table>`;
  $('#t-turnos').querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) => b.addEventListener('click', async () => { if (confirm('¿Cancelar este turno?')) { await api(`/bookings/${b.dataset.cancel}/cancel`, { method: 'POST' }); say('Turno cancelado.'); turnos(); } }));
}

async function bloqueos() {
  const list = await api('/blocks');
  $('#t-bloqueos').innerHTML = `<h2>Bloqueos</h2><form id="bf" class="row"><label>Desde<input type="date" name="desde" required></label><label>Hasta<input type="date" name="hasta"></label><label>Hora desde<input type="time" name="horaDesde"></label><label>Hora hasta<input type="time" name="horaHasta"></label><label>Motivo<input name="motivo"></label><button>Bloquear</button></form><p><small>Sin horas = se bloquea el día completo.</small></p><table><thead><tr><th>Desde</th><th>Hasta</th><th>Horas</th><th>Motivo</th><th></th></tr></thead><tbody>${list.map((b: any) => `<tr><td>${esc(b.desde)}</td><td>${esc(b.hasta)}</td><td>${esc(b.horaDesde)} ${esc(b.horaHasta)}</td><td>${esc(b.motivo)}</td><td><button data-del="${esc(b.id)}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="5">Sin bloqueos.</td></tr>'}</tbody></table>`;
  $<HTMLFormElement>('#bf').addEventListener('submit', async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target as HTMLFormElement)); try { await api('/blocks', { method: 'POST', body: JSON.stringify(d) }); say('Bloqueo agregado.'); bloqueos(); } catch (er) { say((er as Error).message, true); } });
  $('#t-bloqueos').querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => { await api(`/blocks/${b.dataset.del}`, { method: 'DELETE' }); bloqueos(); }));
}

async function horarios() {
  const h = await api('/horarios');
  $('#t-horarios').innerHTML = `<h2>Horarios de atención</h2><p><small>Formato JSON. Días: 0 = domingo … 6 = sábado. Cada día es una lista de franjas ["desde","hasta"]. "paso" son los minutos entre turnos.</small></p><textarea id="hj" spellcheck="false" aria-label="Horarios en JSON">${esc(JSON.stringify(h, null, 2))}</textarea><p><button id="hs">Guardar horarios</button></p>`;
  $('#hs').addEventListener('click', async () => { try { await api('/horarios', { method: 'PUT', body: $<HTMLTextAreaElement>('#hj').value }); say('Horarios guardados.'); } catch (er) { say((er as Error).message || 'JSON inválido', true); } });
}

const tabs: Record<string, () => Promise<void>> = { turnos, bloqueos, horarios };
function tab(n: string) {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === n)));
  for (const k in tabs) $('#t-' + k).hidden = k !== n;
  tabs[n]().catch((e) => say(e.message, true));
}
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab!)));
$('#logout').addEventListener('click', () => { sessionStorage.removeItem('admin'); location.reload(); });

async function enter() {
  try { await api('/ping'); $('#login').hidden = true; $('#app').hidden = false; tab('turnos'); } catch { sessionStorage.removeItem('admin'); if (token) $('#login-err').textContent = 'Clave incorrecta.'; }
}
$('#login').addEventListener('submit', (e) => { e.preventDefault(); token = $<HTMLInputElement>('#pw').value; sessionStorage.setItem('admin', token); enter(); });
if (token) enter();
