import ciudades from '../content/ciudades.json';
import { Wheel } from './wheel';
import { cartaNatal, localAUtc, SIGNOS, fmtGrados, signoDe } from './ephemeris';
import { renderPlanetList } from './today';

export function initNatal() {
  const form = document.getElementById('natal-form') as HTMLFormElement;
  const dl = document.getElementById('ciudades')!;
  dl.innerHTML = ciudades.map((c) => `<option value="${c.nombre}"></option>`).join('');
  const wheel = new Wheel(document.getElementById('natal-wheel')!, { houses: true });
  wheel.svg.setAttribute('aria-label', 'Rueda de tu carta natal');
  const note = document.getElementById('natal-note')!;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const fecha = String(d.get('fecha') || ''), hora = String(d.get('hora') || ''), ciudad = String(d.get('ciudad') || '');
    form.querySelector('.err')?.remove();
    if (!fecha) {
      const p = document.createElement('p'); p.className = 'err'; p.setAttribute('role', 'alert'); p.textContent = 'Ingresá tu fecha de nacimiento.';
      form.insertBefore(p, note); return;
    }
    const c = ciudades.find((x) => x.nombre.toLowerCase() === ciudad.trim().toLowerCase());
    const completo = !!(hora && c);
    const utc = localAUtc(fecha, hora || '12:00', c?.tz ?? 'America/Argentina/Buenos_Aires');
    const carta = completo ? cartaNatal(utc, c!.lat, c!.lon) : cartaNatal(utc);
    wheel.setRot(completo ? carta.asc! : 0);
    wheel.setPlanets(carta.planetas, { animate: true, aspects: true, duration: 2 });
    wheel.draw(wheel.svg.querySelector('.rings')!, 2.2);
    const extra = completo
      ? `Ascendente en ${SIGNOS[signoDe(carta.asc!)]} ${fmtGrados(carta.asc!)} · Medio Cielo en ${SIGNOS[signoDe(carta.mc!)]} ${fmtGrados(carta.mc!)}. Casas por signo entero.`
      : !hora ? 'Sin hora de nacimiento mostramos solo planetas en signos (la Luna puede variar hasta 6° en el día).' : 'Ciudad fuera de la lista: mostramos solo planetas en signos. Elegí una de la lista para calcular ascendente y casas.';
    note.textContent = extra;
    const out = document.getElementById('natal-out')!;
    out.hidden = false;
    renderPlanetList(document.getElementById('natal-list')!, carta.planetas);
    if (completo) {
      const ul = document.getElementById('natal-list')!;
      ul.insertAdjacentHTML('afterbegin', `<li><span class="g" aria-hidden="true">AC</span><span class="n">Ascendente</span><span class="d">${SIGNOS[signoDe(carta.asc!)]} ${fmtGrados(carta.asc!)}</span></li>`);
    }
    // Si hay hora y ciudad, usar el nacimiento como pre-carga del turnero
    sessionStorage.setItem('natal', JSON.stringify({ fecha, hora, lugar: c?.nombre ?? ciudad }));
  });
}
