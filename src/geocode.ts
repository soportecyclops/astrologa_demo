import ciudades from '../content/ciudades.json';

export interface Lugar { label: string; lat: number; lon: number; tz: string }

/** Sugerencias iniciales y fallback: ciudades argentinas comunes (content/ciudades.json). */
export const LOCALES: Lugar[] = ciudades.map((c) => ({ label: c.nombre, lat: c.lat, lon: c.lon, tz: c.tz }));
export const INICIALES = LOCALES.slice(0, 10);

const quitar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function buscarLocal(q: string): Lugar[] {
  const n = quitar(q.trim());
  return LOCALES.filter((l) => quitar(l.label).includes(n)).slice(0, 8);
}

interface ApiRes { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }[] }

/** Open-Meteo Geocoding. Lanza error si falla, para que el llamador use el fallback local. */
export async function buscarCiudad(q: string, signal?: AbortSignal): Promise<Lugar[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=es`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Geocoding ${r.status}`);
  const j = (await r.json()) as ApiRes;
  return (j.results ?? [])
    .filter((x) => x.timezone)
    .map((x) => ({ label: [x.name, x.admin1, x.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '), lat: x.latitude, lon: x.longitude, tz: x.timezone! }));
}

/** Autocompletado accesible (patrón combobox) con debounce de 300 ms. */
export function initAutocomplete(input: HTMLInputElement, list: HTMLUListElement, onPick: (l: Lugar | null) => void, status?: HTMLElement) {
  let items: Lugar[] = [], active = -1, timer = 0, ctl: AbortController | null = null;
  const say = (t: string) => { if (status) status.textContent = t; };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const render = (src: Lugar[], aviso = '') => {
    items = src;
    list.innerHTML = src.map((l, i) => `<li role="option" id="${list.id}-${i}" aria-selected="false">${l.label.replace(/[<>&]/g, '')}</li>`).join('') + (aviso ? `<li class="ac-note" role="presentation">${aviso}</li>` : '');
    list.hidden = !src.length && !aviso;
    input.setAttribute('aria-expanded', String(!list.hidden));
    say(src.length ? `${src.length} sugerencias disponibles` : 'Sin resultados');
  };
  const choose = (i: number) => { const l = items[i]; if (!l) return; input.value = l.label; close(); onPick(l); };
  const setActive = (i: number) => {
    active = (i + items.length) % items.length;
    list.querySelectorAll('[role=option]').forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    list.querySelectorAll('[role=option]')[active]?.scrollIntoView({ block: 'nearest' });
  };
  input.addEventListener('focus', () => { if (!input.value.trim()) render(INICIALES); });
  input.addEventListener('input', () => {
    onPick(null);
    clearTimeout(timer); ctl?.abort();
    const q = input.value.trim();
    if (q.length < 2) { render(q ? [] : INICIALES); if (q) close(); return; }
    timer = window.setTimeout(async () => {
      ctl = new AbortController();
      try {
        const res = await buscarCiudad(q, ctl.signal);
        render(res.length ? res : buscarLocal(q));
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        render(buscarLocal(q), 'Sin conexión con el buscador: mostramos ciudades frecuentes.');
      }
    }, 300);
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', (e) => { // mousedown: antes de que el input pierda foco
    const li = (e.target as HTMLElement).closest('[role=option]'); if (!li) return;
    e.preventDefault(); choose([...list.children].indexOf(li));
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
}
