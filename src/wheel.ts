import gsap from 'gsap';
import { SIGNOS, norm, type Pos } from './ephemeris';
import signos from '../content/signos.json';

const NS = 'http://www.w3.org/2000/svg';
export const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
};

const R = { out: 470, signIn: 392, planet: 340, houseIn: 250, houseNum: 285, core: 120 };
const TEXT = '︎'; // fuerza glifo de texto (no emoji)

export interface WheelOpts { interactive?: boolean; rot?: number; houses?: boolean; labelled?: boolean }

export class Wheel {
  svg: SVGSVGElement;
  gSigns: SVGGElement;
  gHouses: SVGGElement;
  gPlanets: SVGGElement;
  gAspects: SVGGElement;
  rot: number;
  onHover?: (kind: 'signo' | 'casa' | null, i: number) => void;
  onPick?: (kind: 'signo' | 'casa', i: number) => void;

  constructor(host: Element, public opts: WheelOpts = {}) {
    this.rot = opts.rot ?? 0;
    this.svg = el('svg', { viewBox: '-500 -500 1000 1000', class: 'wheel', role: 'img', 'aria-label': 'Rueda zodiacal con los doce signos y las doce casas' });
    host.appendChild(this.svg);
    const g = el('g', { class: 'rings', fill: 'none' }, this.svg);
    for (const r of [R.out, R.signIn, R.houseIn, R.core]) el('circle', { r, class: 'line' }, g);
    el('circle', { r: R.out + 14, class: 'line thin' }, g);
    // marcas de grados
    for (let d = 0; d < 360; d += 5) {
      const a = this.ang(d);
      const len = d % 30 === 0 ? 22 : d % 10 === 0 ? 14 : 8;
      el('line', { x1: Math.cos(a) * R.out, y1: Math.sin(a) * R.out, x2: Math.cos(a) * (R.out - len), y2: Math.sin(a) * (R.out - len), class: 'line thin' }, g);
    }
    this.gSigns = el('g', { class: 'signs' }, this.svg);
    this.gHouses = el('g', { class: 'houses' }, this.svg);
    this.gAspects = el('g', { class: 'aspects' }, this.svg);
    this.gPlanets = el('g', { class: 'planets' }, this.svg);
    this.drawSigns();
    this.drawHouses();
  }

  /** ángulo en radianes de pantalla para una longitud eclíptica (antihorario, Aries a la izquierda). */
  ang(lon: number) {
    return ((180 - (lon - this.rot)) * Math.PI) / 180;
  }

  private sector(r1: number, r2: number, l1: number, l2: number) {
    const a1 = this.ang(l1), a2 = this.ang(l2);
    const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    // el ángulo de pantalla disminuye al aumentar la longitud: sweep=0 en el arco exterior
    return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 0 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 1 ${p(r1, a1)}Z`;
  }

  private drawSigns() {
    this.gSigns.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const g = el('g', { class: 'sector', tabindex: this.opts.interactive ? 0 : -1, role: this.opts.interactive ? 'button' : 'presentation', 'aria-label': `${SIGNOS[i]}`, 'data-i': i }, this.gSigns);
      el('path', { d: this.sector(R.signIn, R.out, i * 30, i * 30 + 30), class: 'hit' }, g);
      const a = this.ang(i * 30);
      el('line', { x1: Math.cos(a) * R.signIn, y1: Math.sin(a) * R.signIn, x2: Math.cos(a) * R.out, y2: Math.sin(a) * R.out, class: 'line' }, g);
      const m = this.ang(i * 30 + 15);
      const t = el('text', { x: Math.cos(m) * 431, y: Math.sin(m) * 431, class: 'glyph', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      t.textContent = signos[i].glifo + TEXT;
      if (this.opts.interactive) this.bind(g, 'signo', i);
    }
  }

  drawHouses() {
    this.gHouses.replaceChildren();
    if (this.opts.houses === false) return;
    for (let i = 0; i < 12; i++) {
      const g = el('g', { class: 'sector', tabindex: this.opts.interactive ? 0 : -1, role: this.opts.interactive ? 'button' : 'presentation', 'aria-label': `Casa ${i + 1}`, 'data-i': i }, this.gHouses);
      el('path', { d: this.sector(R.core, R.houseIn, i * 30, i * 30 + 30), class: 'hit' }, g);
      const a = this.ang(i * 30);
      el('line', { x1: Math.cos(a) * R.core, y1: Math.sin(a) * R.core, x2: Math.cos(a) * R.signIn, y2: Math.sin(a) * R.signIn, class: 'line thin' }, g);
      const m = this.ang(i * 30 + 15);
      const t = el('text', { x: Math.cos(m) * 185, y: Math.sin(m) * 185, class: 'num', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      t.textContent = String(i + 1);
      if (this.opts.interactive) this.bind(g, 'casa', i);
    }
  }

  private bind(g: Element, kind: 'signo' | 'casa', i: number) {
    const on = () => { this.clearActive(); g.classList.add('active'); this.onHover?.(kind, i); };
    g.addEventListener('pointerenter', on);
    g.addEventListener('focus', on);
    g.addEventListener('click', () => { on(); this.onPick?.(kind, i); });
    g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); on(); this.onPick?.(kind, i); } });
  }
  clearActive() { this.svg.querySelectorAll('.active').forEach((n) => n.classList.remove('active')); }
  activate(kind: 'signo' | 'casa', i: number) {
    this.clearActive();
    (kind === 'signo' ? this.gSigns : this.gHouses).querySelectorAll('.sector')[i]?.classList.add('active');
  }

  /** Líneas de casas para una carta con casas de signo entero (reubica rotación). */
  setRot(rot: number) {
    this.rot = rot;
    this.drawSigns();
    this.drawHouses();
  }

  setPlanets(pos: Pos[], opts: { animate?: boolean; aspects?: boolean; duration?: number } = {}) {
    this.gPlanets.replaceChildren();
    this.gAspects.replaceChildren();
    const nodes: SVGGElement[] = [];
    const placed: { lon: number; r: number }[] = [];
    const items = pos.map((p) => {
      // separar glifos cercanos en radio
      let r = R.planet;
      let tries = 0;
      while (placed.some((q) => Math.abs(norm(q.lon - p.lon + 180) - 180) < 9 && Math.abs(q.r - r) < 26) && tries < 4) { r -= 28; tries++; }
      placed.push({ lon: p.lon, r });
      return { p, r };
    });
    for (const { p, r } of items) {
      const a = this.ang(p.lon);
      const g = el('g', { class: 'planet', tabindex: 0, role: 'img', 'aria-label': `${p.nombre} en ${SIGNOS[p.signo]}` }, this.gPlanets);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      el('line', { x1: Math.cos(a) * R.signIn, y1: Math.sin(a) * R.signIn, x2: Math.cos(a) * (R.signIn - 14), y2: Math.sin(a) * (R.signIn - 14), class: 'line gold' }, g);
      el('circle', { cx: x, cy: y, r: 20, class: 'pdisc' }, g);
      const t = el('text', { x, y, class: 'pglyph', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      t.textContent = p.glifo + TEXT;
      if (p.retro) {
        const rr = el('text', { x: x + 19, y: y + 17, class: 'retro', 'text-anchor': 'middle' }, g);
        rr.textContent = 'R';
      }
      const title = el('title', {}, g);
      title.textContent = `${p.nombre} en ${SIGNOS[p.signo]} ${(norm(p.lon) % 30).toFixed(1)}°${p.retro ? ' (retrógrado)' : ''}`;
      nodes.push(g);
    }
    if (opts.aspects) this.drawAspects(pos);
    if (opts.animate) {
      gsap.from(nodes, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.7, stagger: 0.12, ease: 'back.out(1.6)' });
      this.draw(this.gAspects, opts.duration ?? 1.6, 0.6);
    }
  }

  private drawAspects(pos: Pos[]) {
    const tipos = [{ a: 0, o: 6, c: 'asp-c' }, { a: 60, o: 4, c: 'asp-s' }, { a: 90, o: 5, c: 'asp-q' }, { a: 120, o: 5, c: 'asp-t' }, { a: 180, o: 6, c: 'asp-o' }];
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const d = Math.abs(norm(pos[i].lon - pos[j].lon + 180) - 180);
        const t = tipos.find((x) => x.a !== 0 && Math.abs(d - x.a) <= x.o);
        if (!t) continue;
        const a1 = this.ang(pos[i].lon), a2 = this.ang(pos[j].lon), r = R.core + 6;
        el('line', { x1: Math.cos(a1) * r, y1: Math.sin(a1) * r, x2: Math.cos(a2) * r, y2: Math.sin(a2) * r, class: `line aspect ${t.c}` }, this.gAspects);
      }
    }
  }

  /** Animación de trazado de todas las líneas dentro de un grupo. */
  draw(root: Element, duration = 2, delay = 0) {
    const shapes = Array.from(root.querySelectorAll<SVGGeometryElement>('line,circle,path')).filter((s) => !s.classList.contains('hit') && !s.classList.contains('pdisc'));
    shapes.forEach((s) => { s.setAttribute('pathLength', '1'); s.style.strokeDasharray = '1'; s.style.strokeDashoffset = '1'; });
    return gsap.to(shapes, { strokeDashoffset: 0, duration, delay, ease: 'power2.inOut', stagger: { amount: duration * 0.6 }, onComplete: () => shapes.forEach((s) => { s.style.strokeDasharray = ''; s.style.strokeDashoffset = ''; }) });
  }
}
