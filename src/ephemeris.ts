import * as A from 'astronomy-engine';

export const PLANETAS = [
  { id: 'Sun', nombre: 'Sol', glifo: '☉' },
  { id: 'Moon', nombre: 'Luna', glifo: '☽' },
  { id: 'Mercury', nombre: 'Mercurio', glifo: '☿' },
  { id: 'Venus', nombre: 'Venus', glifo: '♀' },
  { id: 'Mars', nombre: 'Marte', glifo: '♂' },
  { id: 'Jupiter', nombre: 'Júpiter', glifo: '♃' },
  { id: 'Saturn', nombre: 'Saturno', glifo: '♄' },
  { id: 'Uranus', nombre: 'Urano', glifo: '♅' },
  { id: 'Neptune', nombre: 'Neptuno', glifo: '♆' },
  { id: 'Pluto', nombre: 'Plutón', glifo: '♇' },
] as const;

export const SIGNOS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];

export const norm = (d: number) => ((d % 360) + 360) % 360;
export const signoDe = (lon: number) => Math.floor(norm(lon) / 30);
export const fmtGrados = (lon: number) => {
  const l = norm(lon) % 30;
  const g = Math.floor(l);
  const m = Math.floor((l - g) * 60);
  return `${g}° ${String(m).padStart(2, '0')}′`;
};

/** Longitud eclíptica geocéntrica tropical (de la fecha). */
export function lonGeo(id: string, date: Date): number {
  const body = id as A.Body;
  if (id === 'Moon') {
    return A.EclipticGeoMoon(date).lon;
  }
  const v = A.GeoVector(body, date, true);
  const rot = A.Rotation_EQJ_ECT(date);
  return norm(A.SphereFromVector(A.RotateVector(rot, v)).lon);
}

export interface Pos { id: string; nombre: string; glifo: string; lon: number; signo: number; retro: boolean }

export function posiciones(date: Date): Pos[] {
  const prev = new Date(date.getTime() - 3600_000 * 12);
  return PLANETAS.map((p) => {
    const lon = lonGeo(p.id, date);
    let retro = false;
    if (p.id !== 'Sun' && p.id !== 'Moon') {
      const d = norm(lon - lonGeo(p.id, prev) + 180) - 180;
      retro = d < 0;
    }
    return { id: p.id, nombre: p.nombre, glifo: p.glifo, lon, signo: signoDe(lon), retro };
  });
}

/** Posición heliocéntrica en el plano de la eclíptica (UA), para la escena 3D. */
export function helio(id: string, date: Date): { x: number; y: number; z: number; r: number; lon: number } {
  if (id === 'Sun') return { x: 0, y: 0, z: 0, r: 0, lon: 0 };
  const v = A.HelioVector(id as A.Body, date);
  const e = A.RotateVector(A.Rotation_EQJ_ECL(), v);
  const lon = (Math.atan2(e.y, e.x) * 180) / Math.PI;
  return { x: e.x, y: e.z, z: -e.y, r: Math.hypot(e.x, e.y, e.z), lon };
}

/** Fase lunar: 0–360, texto y porcentaje de iluminación. */
export function faseLunar(date: Date) {
  const ang = A.MoonPhase(date);
  const ilum = A.Illumination(A.Body.Moon, date).phase_fraction;
  const nombres: [number, string][] = [
    [22.5, 'Luna nueva'], [67.5, 'Luna creciente'], [112.5, 'Cuarto creciente'], [157.5, 'Gibosa creciente'],
    [202.5, 'Luna llena'], [247.5, 'Gibosa menguante'], [292.5, 'Cuarto menguante'], [337.5, 'Luna menguante'],
  ];
  const nombre = nombres.find(([lim]) => ang < lim)?.[1] ?? 'Luna nueva';
  return { angulo: ang, ilum, nombre };
}

export interface Evento { fecha: Date; titulo: string; detalle?: string }

export function proximosEventos(desde: Date): Evento[] {
  const out: Evento[] = [];
  const nombres = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante'];
  let q = A.SearchMoonQuarter(desde);
  for (let i = 0; i < 8; i++) {
    if (q.quarter === 0 || q.quarter === 2) {
      const f = q.time.date;
      out.push({ fecha: f, titulo: nombres[q.quarter], detalle: `en ${SIGNOS[signoDe(lonGeo('Moon', f))]}` });
    }
    q = A.NextMoonQuarter(q);
  }
  // Retrógrados: estaciones (cambio de dirección) en los próximos ~14 meses.
  for (const p of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const nombre = PLANETAS.find((x) => x.id === p)!.nombre;
    const dir = (t: number) => {
      const d = new Date(t);
      return norm(lonGeo(p, new Date(t + 86400000)) - lonGeo(p, d) + 180) - 180 < 0;
    };
    let t = desde.getTime();
    let r = dir(t);
    for (let day = 1; day < 430; day++) {
      t += 86400000;
      const n = dir(t);
      if (n !== r) {
        out.push({ fecha: new Date(t), titulo: `${nombre} ${n ? 'inicia retrogradación' : 'retoma el movimiento directo'}` });
        r = n;
        if (out.filter((e) => e.titulo.startsWith(nombre)).length >= 1) break;
      }
    }
  }
  return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(0, 8);
}

/** Convierte hora local en una zona IANA a un Date UTC. */
export function localAUtc(fecha: string, hora: string, tz: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = (ts: number) => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ts));
    const g = (t: string) => Number(f.find((p) => p.type === t)!.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - ts;
  };
  let ts = guess - off(guess);
  ts = guess - off(ts);
  return new Date(ts);
}

export interface Carta {
  planetas: Pos[];
  asc?: number;
  mc?: number;
  casas?: number[]; // longitud de inicio de cada casa (signos enteros)
}

export function cartaNatal(utc: Date, lat?: number, lon?: number): Carta {
  const planetas = posiciones(utc);
  if (lat === undefined || lon === undefined) return { planetas };
  const gst = A.SiderealTime(utc); // horas
  const ramc = norm(gst * 15 + lon);
  const eps = (A.e_tilt(A.MakeTime(utc)).mobl * Math.PI) / 180;
  const th = (ramc * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const asc = norm((Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180) / Math.PI);
  const mc = norm((Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(eps)) * 180) / Math.PI);
  const inicio = Math.floor(asc / 30) * 30; // casas de signo entero
  return { planetas, asc, mc, casas: Array.from({ length: 12 }, (_, i) => norm(inicio + i * 30)) };
}
