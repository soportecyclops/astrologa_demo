import { Wheel } from './wheel';
import { cartaNatal, localAUtc, SIGNOS, fmtGrados, signoDe } from './ephemeris';
import { renderPlanetList } from './today';
import { initAutocomplete, buscarLocal, type Lugar } from './geocode';

export function initNatal() {
  const form = document.getElementById('natal-form') as HTMLFormElement;
  const wheel = new Wheel(document.getElementById('natal-wheel')!, { houses: true });
  wheel.svg.setAttribute('aria-label', 'Rueda de tu carta natal');
  const note = document.getElementById('natal-note')!;
  const input = form.elements.namedItem('ciudad') as HTMLInputElement;
  let lugar: Lugar | null = null;
  initAutocomplete(input, document.getElementById('ciudad-list') as HTMLUListElement, (l) => { lugar = l; }, document.getElementById('ciudad-status')!);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const fecha = String(d.get('fecha') || ''), hora = String(d.get('hora') || '');
    form.querySelector('.err')?.remove();
    if (!fecha) {
      const p = document.createElement('p'); p.className = 'err'; p.setAttribute('role', 'alert'); p.textContent = 'Ingresá tu fecha de nacimiento.';
      form.insertBefore(p, note); return;
    }
    // Si escribió el nombre exacto de una ciudad conocida sin elegirla de la lista, la tomamos igual.
    const c = lugar ?? (input.value.trim() ? buscarLocal(input.value).find((l) => l.label.toLowerCase() === input.value.trim().toLowerCase()) ?? null : null);
    const completo = !!(hora && c);
    // La zona horaria sale de la API; Intl aplica el horario de verano histórico de esa zona y fecha.
    const utc = localAUtc(fecha, hora || '12:00', c?.tz ?? 'America/Argentina/Buenos_Aires');
    const carta = completo ? cartaNatal(utc, c!.lat, c!.lon) : cartaNatal(utc);
    wheel.setRot(completo ? carta.asc! : 0);
    wheel.setPlanets(carta.planetas, { animate: true, aspects: true, duration: 2 });
    wheel.draw(wheel.svg.querySelector('.rings')!, 2.2);
    note.textContent = completo
      ? `Ascendente en ${SIGNOS[signoDe(carta.asc!)]} ${fmtGrados(carta.asc!)} · Medio Cielo en ${SIGNOS[signoDe(carta.mc!)]} ${fmtGrados(carta.mc!)}. Casas por signo entero. Zona horaria: ${c!.tz}.`
      : !hora ? 'Sin hora de nacimiento mostramos solo planetas en signos (la Luna puede variar hasta 6° en el día).' : 'Elegí una ciudad de la lista para calcular ascendente y casas; por ahora mostramos solo planetas en signos.';
    const out = document.getElementById('natal-out')!;
    out.hidden = false;
    renderPlanetList(document.getElementById('natal-list')!, carta.planetas);
    if (completo) document.getElementById('natal-list')!.insertAdjacentHTML('afterbegin', `<li><span class="g" aria-hidden="true">AC</span><span class="n">Ascendente</span><span class="d">${SIGNOS[signoDe(carta.asc!)]} ${fmtGrados(carta.asc!)}</span></li>`);
    sessionStorage.setItem('natal', JSON.stringify({ fecha, hora, lugar: c?.label ?? input.value }));
  });
}
