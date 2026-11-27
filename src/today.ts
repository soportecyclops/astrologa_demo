import { faseLunar, posiciones, proximosEventos, SIGNOS, fmtGrados } from './ephemeris';

const fmtFecha = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

export function renderPlanetList(ul: HTMLElement, pos: ReturnType<typeof posiciones>) {
  ul.innerHTML = pos.map((p) => `<li><span class="g" aria-hidden="true">${p.glifo}︎</span><span class="n">${p.nombre}</span><span class="d">${SIGNOS[p.signo]} ${fmtGrados(p.lon)}</span>${p.retro ? '<span class="r" title="Retrógrado">R</span>' : ''}</li>`).join('');
}

function drawMoon(canvas: HTMLCanvasElement, angulo: number) {
  const ctx = canvas.getContext('2d')!, w = canvas.width, c = w / 2, r = w * 0.4;
  ctx.clearRect(0, 0, w, w);
  const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  g.addColorStop(0, '#f4f1e6'); g.addColorStop(1, '#a9afc4');
  // disco oscuro
  ctx.fillStyle = '#10132b'; ctx.beginPath(); ctx.arc(c, c, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  // parte iluminada: semicírculo + elipse terminador
  const rad = (angulo * Math.PI) / 180;
  const k = Math.cos(rad); // 1 nueva … -1 llena
  const crece = angulo < 180;
  ctx.save(); ctx.beginPath(); ctx.arc(c, c, r - 1, 0, 7); ctx.clip();
  ctx.fillStyle = g; ctx.beginPath();
  const dir = crece ? 1 : -1; // el hemisferio sur ve la luna creciente iluminada a la izquierda
  ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, crece ? true : false);
  ctx.ellipse(c, c, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === crece);
  ctx.fill();
  void dir;
  ctx.restore();
}

export function initToday() {
  const now = new Date();
  const f = faseLunar(now);
  drawMoon(document.getElementById('moon') as HTMLCanvasElement, f.angulo);
  const pos = posiciones(now);
  document.getElementById('moon-name')!.textContent = f.nombre;
  document.getElementById('moon-meta')!.textContent = `${Math.round(f.ilum * 100)} % iluminada · Luna en ${SIGNOS[pos[1].signo]}`;
  renderPlanetList(document.getElementById('hoy-list')!, pos);
  const ev = proximosEventos(now);
  document.getElementById('eventos')!.innerHTML = ev.map((e) => `<li><strong>${e.titulo[0].toUpperCase() + e.titulo.slice(1)}${e.detalle ? ' ' + e.detalle : ''}</strong><span>${fmtFecha.format(e.fecha)}</span></li>`).join('');
  document.getElementById('today-date')!.textContent = fmtFecha.format(now);
  return pos;
}
