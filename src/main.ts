import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Howl } from 'howler';
import site from '../content/site.json';
import signos from '../content/signos.json';
import casas from '../content/casas.json';
import { Wheel } from './wheel';
import { initTrail } from './cursor';
import { initToday } from './today';
import { initNatal } from './natal';
import { initBooking } from './booking';
import { Orrery, PLANET_DEF } from './scene';
import { SIGNOS } from './ephemeris';

gsap.registerPlugin(ScrollTrigger);
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) document.documentElement.classList.add('reduced');

// ---------- Contenido editable ----------
$('#lede').textContent = site.frase;
$('#aviso').textContent = site.aviso;
$('#year').textContent = String(new Date().getFullYear());
$('#bio').innerHTML = site.bio.parrafos.map((p) => `<p>${p}</p>`).join('');
$('#testi').innerHTML = site.testimonios.map((t) => `<li><blockquote>“${t.texto}”</blockquote><cite>— ${t.autor} (ejemplo)</cite></li>`).join('');

// ---------- WebGL ----------
let orrery: Orrery | null = null;
const canvas = $<HTMLCanvasElement>('#gl');
try {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('sin WebGL');
  orrery = new Orrery(canvas);
  if (reduce) orrery.frozen = true;
} catch {
  document.documentElement.classList.add('no-gl');
}

// ---------- Audio (apagado por defecto) ----------
let music: Howl | null = null;
let soundOn = false;
const soundBtn = $<HTMLButtonElement>('#sound');
function setSound(on: boolean) {
  soundOn = on;
  if (on && !music) music = new Howl({ src: ['/audio/ambient.wav'], loop: true, volume: 0, html5: false });
  if (on) { music!.play(); music!.fade(0, 0.35, 1800); } else music?.fade(music.volume(), 0, 800);
  if (!on) setTimeout(() => { if (!soundOn) music?.pause(); }, 900);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Silenciar sonido ambiente' : 'Activar sonido ambiente');
}
soundBtn.addEventListener('click', () => setSound(!soundOn));

// ---------- Acto 0 · Entrada ----------
const intro = $('#intro');
const introWheel = new Wheel($('#intro-wheel'), { houses: true });
const enterBtn = $<HTMLButtonElement>('#enter');
const count = $('#count');
document.body.classList.add('locked');
window.scrollTo(0, 0);
const prog = { v: 0 };
const loadTl = gsap.timeline();
const wheelLines = introWheel.svg;
wheelLines.querySelectorAll('.glyph,.num').forEach((n) => ((n as SVGElement).style.opacity = '0'));
loadTl
  .add(introWheel.draw(wheelLines, reduce ? 0.5 : 3.6), 0.3)
  .to(wheelLines.querySelectorAll('.glyph,.num'), { opacity: 1, duration: 1, stagger: 0.04 }, reduce ? 0.2 : 2.6)
  .to(prog, { v: 100, duration: reduce ? 0.5 : 3.9, ease: 'power1.inOut', onUpdate: () => (count.textContent = String(Math.round(prog.v))) }, 0);
const fontsReady = document.fonts?.ready ?? Promise.resolve();
Promise.all([new Promise((r) => loadTl.eventCallback('onComplete', () => r(null))), fontsReady]).then(() => {
  intro.classList.add('ready');
  enterBtn.disabled = false;
  enterBtn.focus();
});

// ---------- Scroll suave ----------
let lenis: Lenis | null = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = (target: string | number, immediate = false) => {
  if (lenis) lenis.scrollTo(target as string, { immediate, duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
  else window.scrollTo(0, target);
};
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => { const h = a.getAttribute('href')!; if (h.length > 1 && document.querySelector(h)) { e.preventDefault(); scrollTo(h); } });
});

// ---------- Entrar al cielo ----------
let entered = false;
enterBtn.addEventListener('click', () => {
  if ($<HTMLInputElement>('#intro-sound').checked) setSound(true);
  entered = true;
  if (orrery) { orrery.snapCamera(orrery.pose.clone().set(0, 190, 2)); orrery.start(); }
  const tl = gsap.timeline({ onComplete: () => { intro.remove(); document.body.classList.remove('locked'); lenis?.start(); } });
  tl.to('.intro-ui', { opacity: 0, duration: 0.5 }, 0)
    .to(introWheel.svg, { scale: reduce ? 1 : 7, opacity: 0, duration: reduce ? 0.4 : 2.2, ease: 'power3.in' }, 0)
    .to(intro, { opacity: 0, duration: reduce ? 0.3 : 1.2, ease: 'power1.inOut' }, reduce ? 0 : 1.1)
    .add(() => { document.body.classList.add('entered'); heroIn(); }, reduce ? 0 : 1.3);
});

function heroIn() {
  if (reduce) return;
  gsap.from('.hero-copy > *', { y: 50, opacity: 0, duration: 1.4, ease: 'power3.out', stagger: 0.14 });
  gsap.from('.hero-hint, .scroll-cue', { opacity: 0, delay: 1.6, duration: 1.2 });
}

// ---------- Cursor constelación + parallax + clic en planetas ----------
if (!reduce && matchMedia('(pointer: fine)').matches) initTrail($('#trail'));
if (orrery) {
  const o = orrery;
  addEventListener('pointermove', (e) => { o.mouse.set((e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2); }, { passive: true });
  const hint = $('#hero-hint');
  const original = hint.innerHTML;
  const facts: Record<string, string> = { Mercury: '88 días por vuelta', Venus: '225 días por vuelta', Earth: '365 días por vuelta', Mars: '687 días por vuelta', Jupiter: '11,9 años por vuelta', Saturn: '29,5 años por vuelta', Uranus: '84 años por vuelta', Neptune: '165 años por vuelta' };
  addEventListener('click', (e) => {
    if (!entered || scrollY > innerHeight * 0.7 || (e.target as HTMLElement).closest('a,button,header,nav')) return;
    const pl = o.pick(e.clientX, e.clientY);
    o.focusPlanet(pl && pl !== o.focused ? pl : null);
    hint.textContent = o.focused ? `${o.focused.def.nombre} · ${facts[o.focused.def.id]} · tocá otra vez para volver` : '';
    if (!o.focused) hint.innerHTML = original;
  });
  // recorrido automático tras 2 min sin interacción
  let idle = 0, touring = false;
  const wake = () => { idle = 0; if (touring) { touring = false; if (o.mode === 'scroll' && !pinnedActive) o.mode = 'hero'; } };
  ['pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  let tourT = 0;
  setInterval(() => {
    if (!entered || reduce || scrollY > innerHeight * 0.7 || pinnedActive) return;
    idle += 1;
    if (idle >= 120 && !touring) { touring = true; o.focusPlanet(null); tourT = 0; }
  }, 1000);
  o.onFrame = (dt) => {
    if (touring) { tourT += dt; o.mode = 'scroll'; o.scrollP = 0.5 - 0.5 * Math.cos((tourT / 70) * Math.PI * 2) * 0.86 - 0.0 + 0.0; o.scrollP = Math.min(0.86, Math.max(0, (1 - Math.cos((tourT / 70) * Math.PI * 2)) * 0.43)); o.dayOffset += dt * 60; }
  };
}

// ---------- Acto 2 · Viaje ----------
let pinnedActive = false;
const viajeWheel = new Wheel($('#viaje-wheel'), { houses: true });
const today = initToday();
viajeWheel.setPlanets(today);
const stopsText = [
  ['El tiempo se acelera', 'Un viaje hacia vos', 'Cada planeta recorre su órbita a su propio ritmo. Seguí bajando.'],
  ['Mercurio', 'El más veloz', '88 días terrestres por vuelta al Sol.'],
  ['Venus', 'El más brillante', '225 días por vuelta; gira en sentido contrario al resto.'],
  ['Marte', 'El planeta rojo', '687 días por vuelta: casi dos años terrestres.'],
  ['Júpiter', 'El gigante', '11,9 años por vuelta. Más masivo que todos los demás juntos.'],
  ['Saturno', 'Señor de los anillos', '29,5 años por vuelta: un ciclo de Saturno dura media vida.'],
  ['Neptuno', 'El último', '165 años por vuelta: aún no completó una órbita desde su descubrimiento.'],
  ['La Tierra', 'Aterrizamos', 'Desde acá miramos el cielo. Así se ve hoy.'],
];
if (orrery && !reduce) {
  const o = orrery;
  const baseYear = new Date().getFullYear();
  let lastIdx = -1, wheelShown = false;
  ScrollTrigger.create({
    trigger: '#viaje', start: 'top top', end: '+=650%', pin: '.viaje-pin', scrub: 0.6, anticipatePin: 1,
    onToggle: (s) => { pinnedActive = s.isActive; if (s.isActive) { o.focusPlanet(null); o.mode = 'scroll'; } else if (o.mode === 'scroll') o.mode = 'hero'; },
    onUpdate: (s) => {
      const p = s.progress;
      o.scrollP = p;
      o.dayOffset = 5200 * Math.pow(p, 2.6);
      $('#v-year').textContent = String(baseYear + Math.floor(o.dayOffset / 365.25));
      const idx = Math.min(stopsText.length - 1, Math.round(p * (stopsText.length - 1)));
      if (idx !== lastIdx) {
        lastIdx = idx;
        const cap = $('.viaje-caption');
        gsap.fromTo(cap, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
        $('#v-eyebrow').textContent = stopsText[idx][0]; $('#v-title').textContent = stopsText[idx][1]; $('#v-text').textContent = stopsText[idx][2];
      }
      const w = Math.max(0, (p - 0.9) / 0.1);
      gsap.set('#viaje-wheel', { opacity: w, pointerEvents: w > 0.5 ? 'auto' : 'none' });
      gsap.set('.viaje-caption', { autoAlpha: 1 - Math.min(1, w * 3) });
      if (w > 0.05 && !wheelShown) { wheelShown = true; viajeWheel.draw(viajeWheel.svg, 2.4); viajeWheel.setPlanets(today, { animate: true }); }
      if (w === 0) wheelShown = false;
    },
  });
  $('#skip-viaje').addEventListener('click', () => scrollTo('#casas'));
} else {
  $('#skip-viaje').remove();
}

// pausar render al estar lejos de la escena
if (orrery) {
  const o = orrery;
  ScrollTrigger.create({ trigger: '#casas', start: 'top 90%', onEnter: () => { canvas.style.opacity = '0'; o.running = false; }, onLeaveBack: () => { o.running = true; canvas.style.opacity = '1'; } });
}

// ---------- Acto 3 · Casas y signos ----------
const cw = new Wheel($('#casas-wheel'), { interactive: true });
const show = (kind: 'signo' | 'casa' | null, i: number) => {
  if (!kind) return;
  if (kind === 'signo') {
    const s = signos[i];
    $('#info-kind').textContent = 'Signo'; $('#info-title').textContent = s.nombre;
    $('#info-meta').textContent = `Elemento ${s.elemento}`; $('#info-text').textContent = s.texto;
  } else {
    const c = casas[i];
    $('#info-kind').textContent = c.nombre; $('#info-title').textContent = c.tema;
    $('#info-meta').textContent = `Casa ${c.n} de 12`; $('#info-text').textContent = c.texto;
  }
};
cw.onHover = show;
cw.onPick = show;
ScrollTrigger.create({ trigger: '#casas', start: 'top 70%', once: true, onEnter: () => { if (!reduce) cw.draw(cw.svg, 2.4); } });

// Menú de signos + transición telescopio
const menu = $('#signs-menu'), menuBtn = $('#signs-btn');
$('#signs-list').innerHTML = signos.map((s, i) => `<li><button data-i="${i}"><span aria-hidden="true">${s.glifo}︎</span>${s.nombre}</button></li>`).join('');
const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); };
menuBtn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button')!.focus(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
menu.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
  const i = Number(b.dataset.i);
  menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
  const tel = $('#telescope');
  const go = () => { scrollTo('#casas', true); show('signo', i); cw.activate('signo', i); };
  if (reduce) { go(); return; }
  const v = { r: 140 };
  const paint = () => { tel.style.background = `radial-gradient(circle at 50% 50%, transparent ${v.r}%, #02030a calc(${v.r}% + 1.5%))`; };
  tel.style.opacity = '1';
  gsap.timeline({ onComplete: () => { tel.style.opacity = '0'; } })
    .to(v, { r: 0, duration: 0.7, ease: 'power3.in', onUpdate: paint })
    .add(go)
    .to(v, { r: 140, duration: 0.9, ease: 'power3.out', onUpdate: paint }, '+=0.12');
}));

// ---------- Actos 4–7 ----------
initNatal();
initBooking();

// ---------- Reveals ----------
if (!reduce) {
  gsap.utils.toArray<HTMLElement>('.panel-head, .info, .moon-card, .hoy-grid > div, .card, .about, .testi li, .form').forEach((n) => {
    gsap.from(n, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 88%', once: true } });
  });
  // hero se desvanece al scrollear
  gsap.to('.hero-copy', { opacity: 0, y: -80, scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true } });
}

// reanudar si se redimensiona (recalcula pins)
addEventListener('resize', () => ScrollTrigger.refresh());
void PLANET_DEF; void SIGNOS;
