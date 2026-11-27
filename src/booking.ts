import servicios from '../content/servicios.json';
import site from '../content/site.json';
import ciudades from '../content/ciudades.json';
import gsap from 'gsap';

interface Turno { id: string; servicioNombre: string; duracion: number; precio: number; fecha: string; hora: string; nombre: string }
const money = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fechaLarga = (f: string) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(f + 'T00:00:00Z'));
const pad = (n: number) => String(n).padStart(2, '0');

const state = { step: 0, servicio: '', fecha: '', hora: '', mes: new Date(), datos: {} as Record<string, string> };
let body: HTMLElement, steps: HTMLElement;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function go(n: number) {
  const prev = body.firstElementChild;
  const render = () => {
    state.step = n;
    steps.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('on', i === n); li.classList.toggle('done', i < n); if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    body.replaceChildren();
    [stepServicio, stepFecha, stepDatos, stepOk][n]();
    if (!reduce) gsap.from(body.children, { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out', stagger: 0.06 });
    (body.querySelector('h3,button,input') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  if (prev && !reduce) gsap.to(body.children, { opacity: 0, y: -16, duration: 0.25, onComplete: render }); else render();
}

function stepServicio() {
  body.innerHTML = `<h3 tabindex="-1">¿Qué sesión querés reservar?</h3><div class="opt-list">${servicios.map((s) => `<button class="opt" data-id="${s.id}" aria-pressed="${state.servicio === s.id}"><strong>${s.nombre}</strong><span>${s.descripcion}</span><span class="meta" style="color:var(--gold)">${s.duracion} min · ${money(s.precio)}</span></button>`).join('')}</div>`;
  body.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => b.addEventListener('click', () => { state.servicio = b.dataset.id!; state.fecha = ''; state.hora = ''; go(1); }));
}

async function stepFecha() {
  const s = servicios.find((x) => x.id === state.servicio)!;
  body.innerHTML = `<h3 tabindex="-1">${s.nombre} · elegí día y horario</h3><div class="cal-wrap"><div><div class="cal-head"><button id="prev" aria-label="Mes anterior">‹</button><strong id="mes"></strong><button id="next" aria-label="Mes siguiente">›</button></div><div class="cal" id="cal" role="group" aria-label="Calendario"></div></div><div><p class="note" id="slot-title">Elegí un día con disponibilidad (marcados con borde dorado).</p><div class="slots" id="slots" role="group" aria-label="Horarios"></div></div></div><div class="step-actions"><button class="btn btn-ghost" id="back">Volver</button><button class="btn btn-gold" id="next-step" ${state.hora ? '' : 'disabled'}>Continuar</button></div>`;
  body.querySelector('#back')!.addEventListener('click', () => go(0));
  body.querySelector('#next-step')!.addEventListener('click', () => go(2));
  const cal = body.querySelector('#cal')!;
  const draw = async () => {
    const y = state.mes.getFullYear(), m = state.mes.getMonth();
    (body.querySelector('#mes') as HTMLElement).textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(state.mes);
    cal.innerHTML = '<span class="dow">L</span><span class="dow">M</span><span class="dow">M</span><span class="dow">J</span><span class="dow">V</span><span class="dow">S</span><span class="dow">D</span>';
    let dias: Record<string, number> = {};
    try { dias = (await (await fetch(`/api/month?servicio=${s.id}&mes=${y}-${pad(m + 1)}`)).json()).dias ?? {}; } catch { cal.insertAdjacentHTML('beforeend', '<p class="err" style="grid-column:1/-1">No pudimos cargar la disponibilidad. ¿Está corriendo la API?</p>'); }
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    for (let i = 0; i < first; i++) cal.insertAdjacentHTML('beforeend', '<span></span>');
    const n = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= n; d++) {
      const f = `${y}-${pad(m + 1)}-${pad(d)}`;
      const has = (dias[f] ?? 0) > 0;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = String(d); b.disabled = !has; b.className = has ? 'has' : '';
      b.setAttribute('aria-pressed', String(state.fecha === f));
      b.setAttribute('aria-label', `${fechaLarga(f)}${has ? '' : ', sin disponibilidad'}`);
      b.addEventListener('click', () => { state.fecha = f; state.hora = ''; (body.querySelector('#next-step') as HTMLButtonElement).disabled = true; cal.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); loadSlots(); });
      cal.appendChild(b);
    }
    (body.querySelector('#prev') as HTMLButtonElement).disabled = y === new Date().getFullYear() && m <= new Date().getMonth();
    if (state.fecha) loadSlots();
  };
  const loadSlots = async () => {
    const box = body.querySelector('#slots')!;
    (body.querySelector('#slot-title') as HTMLElement).textContent = fechaLarga(state.fecha);
    const r = await fetch(`/api/availability?servicio=${s.id}&fecha=${state.fecha}`).then((x) => x.json()).catch(() => ({ slots: [] }));
    box.innerHTML = r.slots.map((h: string) => `<button type="button" aria-pressed="${state.hora === h}">${h}</button>`).join('') || '<p class="note">Sin horarios para ese día.</p>';
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.hora = b.textContent!; box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); (body.querySelector('#next-step') as HTMLButtonElement).disabled = false; }));
    if (!reduce) gsap.from(box.children, { opacity: 0, y: 10, duration: 0.4, stagger: 0.03 });
  };
  body.querySelector('#prev')!.addEventListener('click', () => { state.mes = new Date(state.mes.getFullYear(), state.mes.getMonth() - 1, 1); draw(); });
  body.querySelector('#next')!.addEventListener('click', () => { state.mes = new Date(state.mes.getFullYear(), state.mes.getMonth() + 1, 1); draw(); });
  draw();
}

function stepDatos() {
  const pre = JSON.parse(sessionStorage.getItem('natal') || '{}');
  const v = (k: string, d = '') => state.datos[k] ?? d;
  body.innerHTML = `<h3 tabindex="-1">Tus datos</h3><form class="form" id="datos" novalidate>
    <div class="row2"><label>Nombre y apellido<input name="nombre" required autocomplete="name" value="${v('nombre')}" /></label><label>Teléfono / WhatsApp<input name="telefono" required type="tel" autocomplete="tel" value="${v('telefono')}" /></label></div>
    <label>Email<input name="email" required type="email" autocomplete="email" value="${v('email')}" /></label>
    <p class="note" style="margin-top:.6rem">Datos de nacimiento (para preparar tu carta)</p>
    <div class="row2"><label>Fecha<input type="date" name="nfecha" value="${v('nfecha', pre.fecha ?? '')}" /></label><label>Hora<input type="time" name="nhora" value="${v('nhora', pre.hora ?? '')}" /></label></div>
    <label>Lugar<input name="nlugar" list="ciudades2" value="${v('nlugar', pre.lugar ?? '')}" placeholder="Ciudad, país" /><datalist id="ciudades2">${ciudades.slice(0, 10).map((c) => `<option value="${c.nombre}">`).join('')}</datalist></label>
    <label>Mensaje <small>(opcional)</small><textarea name="mensaje" rows="3">${v('mensaje')}</textarea></label>
    <p class="err" id="err" role="alert" hidden></p>
    <div class="step-actions"><button type="button" class="btn btn-ghost" id="back">Volver</button><button class="btn btn-gold" type="submit">Confirmar reserva</button></div></form>`;
  const form = body.querySelector('#datos') as HTMLFormElement, err = body.querySelector('#err') as HTMLElement;
  body.querySelector('#back')!.addEventListener('click', () => { state.datos = Object.fromEntries(new FormData(form) as unknown as Iterable<[string, string]>); go(1); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form) as unknown as Iterable<[string, string]>) as Record<string, string>;
    state.datos = d;
    const btn = form.querySelector('[type=submit]') as HTMLButtonElement; btn.disabled = true;
    try {
      const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servicio: state.servicio, fecha: state.fecha, hora: state.hora, nombre: d.nombre, email: d.email, telefono: d.telefono, mensaje: d.mensaje, nacimiento: { fecha: d.nfecha, hora: d.nhora, lugar: d.nlugar } }) });
      const j = await r.json();
      if (!r.ok) { err.hidden = false; err.textContent = j.error || 'No pudimos reservar.'; btn.disabled = false; if (r.status === 409) setTimeout(() => go(1), 1400); return; }
      lastTurno = j.turno; go(3);
    } catch { err.hidden = false; err.textContent = 'No hay conexión con el servidor de turnos.'; btn.disabled = false; }
  });
}

let lastTurno: Turno | null = null;

function ics(t: Turno) {
  const [y, m, d] = t.fecha.split('-'), [hh, mm] = t.hora.split(':');
  const ini = `${y}${m}${d}T${hh}${mm}00`;
  const fin = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm + t.duracion));
  const f = `${fin.getUTCFullYear()}${pad(fin.getUTCMonth() + 1)}${pad(fin.getUTCDate())}T${pad(fin.getUTCHours())}${pad(fin.getUTCMinutes())}00`;
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Selene Aldana//Turnero//ES', 'BEGIN:VEVENT', `UID:${t.id}@selene-astrologia`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;TZID=America/Argentina/Buenos_Aires:${ini}`, `DTEND;TZID=America/Argentina/Buenos_Aires:${f}`, `SUMMARY:Sesión de astrología · ${t.servicioNombre}`, `DESCRIPTION:Reserva con ${site.nombre}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' }));
}

function stepOk() {
  const t = lastTurno!;
  const msg = encodeURIComponent(`Hola ${site.nombre}, reservé una sesión de ${t.servicioNombre} para el ${fechaLarga(t.fecha)} a las ${t.hora} (código ${t.id}). Soy ${t.nombre}.`);
  body.innerHTML = `<h3 class="ok-title" tabindex="-1">¡Listo, ${t.nombre.split(' ')[0]}! Tu sesión quedó reservada.</h3>
    <div class="summary"><span><b>Sesión:</b> ${t.servicioNombre} (${t.duracion} min)</span><span><b>Día:</b> ${fechaLarga(t.fecha)}</span><span><b>Hora:</b> ${t.hora} (hora de Buenos Aires)</span><span><b>Valor:</b> ${money(t.precio)}</span><span><b>Código:</b> ${t.id}</span></div>
    <div class="step-actions"><a class="btn btn-gold" target="_blank" rel="noopener" href="https://wa.me/${site.whatsapp}?text=${msg}">Confirmar por WhatsApp</a><a class="btn btn-ghost" download="sesion-astrologia.ics" href="${ics(t)}">Agregar al calendario (.ics)</a></div>
    <p class="note" style="margin-top:1.5rem">${site.aviso}</p>`;
}

export function initBooking() {
  body = document.getElementById('step-body')!; steps = document.getElementById('steps')!;
  document.querySelectorAll<HTMLElement>('[data-service]').forEach((a) => a.addEventListener('click', () => { state.servicio = a.dataset.service!; go(1); }));
  go(0);
  // tarjetas de servicios
  document.getElementById('cards')!.innerHTML = servicios.map((s) => `<li class="card"><h3>${s.nombre}</h3><span class="meta">${s.duracion} min</span><p>${s.descripcion}</p><span class="price">${money(s.precio)}</span><a class="btn btn-ghost" href="#turnero" data-pick="${s.id}">Reservar</a></li>`).join('');
  document.querySelectorAll<HTMLElement>('[data-pick]').forEach((a) => a.addEventListener('click', () => { state.servicio = a.dataset.pick!; go(1); }));
}
