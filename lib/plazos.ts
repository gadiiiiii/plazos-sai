import { AÑOS_CUBIERTOS, MAPA_FERIADOS } from "./feriados";

/**
 * Cálculo de plazos de una solicitud de acceso a la información (SAI).
 *
 * - Art. 14, Ley 20.285: el órgano debe responder dentro de 20 días hábiles
 *   desde la recepción de la solicitud, prorrogables excepcionalmente por
 *   otros 10 días hábiles.
 * - Art. 25, Ley 19.880: son inhábiles los sábados, domingos y festivos, y el
 *   plazo se cuenta desde el día siguiente.
 *
 * Todas las fechas se manejan como "AAAA-MM-DD" y se operan en UTC para que
 * la zona horaria del servidor o del navegador no corra los días.
 */

export const DIAS_PLAZO = 20;
export const DIAS_PRORROGA = 10;

export type MotivoInhabil = "sábado" | "domingo" | "feriado";

export interface DiaInhabil {
  fecha: string;
  motivo: MotivoInhabil;
  nombre?: string;
}

export interface ResultadoPlazo {
  recepcion: string;
  vencimiento: string;
  vencimientoProrroga: string;
  /** Días hábiles restantes respecto de `hoy` (negativo si ya venció). */
  diasRestantes: number | null;
  diasRestantesProrroga: number | null;
  /** Feriados que caen entre la recepción y el vencimiento con prórroga. */
  feriadosEnRango: DiaInhabil[];
  /** true si el cálculo usa fechas fuera de los años con feriados cargados. */
  fueraDeCobertura: boolean;
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaValida(texto: string): boolean {
  const m = RE_FECHA.exec(texto);
  if (!m) return false;
  const [, a, me, d] = m.map(Number);
  const fecha = new Date(Date.UTC(a, me - 1, d));
  return (
    fecha.getUTCFullYear() === a &&
    fecha.getUTCMonth() === me - 1 &&
    fecha.getUTCDate() === d
  );
}

function aDate(texto: string): Date {
  if (!esFechaValida(texto)) {
    throw new Error(`Fecha inválida: "${texto}". Usa el formato AAAA-MM-DD.`);
  }
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

export function motivoInhabil(texto: string): DiaInhabil | null {
  const dia = aDate(texto).getUTCDay();
  if (dia === 6) return { fecha: texto, motivo: "sábado" };
  if (dia === 0) return { fecha: texto, motivo: "domingo" };
  const nombre = MAPA_FERIADOS.get(texto);
  if (nombre) return { fecha: texto, motivo: "feriado", nombre };
  return null;
}

export function esDiaHabil(texto: string): boolean {
  return motivoInhabil(texto) === null;
}

/** Suma `n` días hábiles contando desde el día siguiente a `desde`. */
export function sumarDiasHabiles(desde: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("La cantidad de días debe ser un entero positivo.");
  }
  let actual = aDate(desde);
  let contados = 0;
  while (contados < n) {
    actual = sumarDias(actual, 1);
    if (esDiaHabil(aTexto(actual))) contados++;
  }
  return aTexto(actual);
}

/**
 * Días hábiles que quedan desde `hoy` hasta `vencimiento` (sin contar `hoy`,
 * contando el día del vencimiento). 0 = vence hoy; negativo = vencido.
 */
export function diasHabilesEntre(hoy: string, vencimiento: string): number {
  const a = aDate(hoy);
  const b = aDate(vencimiento);
  if (a.getTime() === b.getTime()) return 0;
  const signo = a < b ? 1 : -1;
  let actual = a;
  let total = 0;
  while (actual.getTime() !== b.getTime()) {
    actual = sumarDias(actual, signo);
    // Hacia adelante cuenta el día de llegada; hacia atrás, el de partida.
    const evaluado = signo === 1 ? actual : sumarDias(actual, 1);
    if (esDiaHabil(aTexto(evaluado))) total += signo;
  }
  return total;
}

export function calcularPlazo(recepcion: string, hoy?: string): ResultadoPlazo {
  const vencimiento = sumarDiasHabiles(recepcion, DIAS_PLAZO);
  const vencimientoProrroga = sumarDiasHabiles(vencimiento, DIAS_PRORROGA);

  const feriadosEnRango: DiaInhabil[] = [];
  let actual = sumarDias(aDate(recepcion), 1);
  const fin = aDate(vencimientoProrroga);
  while (actual <= fin) {
    const info = motivoInhabil(aTexto(actual));
    if (info?.motivo === "feriado") feriadosEnRango.push(info);
    actual = sumarDias(actual, 1);
  }

  const años = [recepcion, vencimientoProrroga].map((f) => Number(f.slice(0, 4)));

  return {
    recepcion,
    vencimiento,
    vencimientoProrroga,
    diasRestantes: hoy ? diasHabilesEntre(hoy, vencimiento) : null,
    diasRestantesProrroga: hoy ? diasHabilesEntre(hoy, vencimientoProrroga) : null,
    feriadosEnRango,
    fueraDeCobertura: años.some((a) => !AÑOS_CUBIERTOS.includes(a)),
  };
}

export interface DiaCalendario {
  fecha: string;
  /** Número de día hábil del plazo (1–30), o null si es inhábil o la recepción. */
  habil: number | null;
  inhabil: DiaInhabil | null;
  esRecepcion: boolean;
}

/**
 * Días desde la recepción hasta el vencimiento con prórroga, rellenados para
 * empezar en lunes y terminar en domingo (semanas completas).
 */
export function construirCalendario(recepcion: string, fin: string): (DiaCalendario | null)[] {
  const inicio = aDate(recepcion);
  const termino = aDate(fin);
  const relleno = (inicio.getUTCDay() + 6) % 7; // lunes = 0
  const celdas: (DiaCalendario | null)[] = Array(relleno).fill(null);

  let contador = 0;
  for (let d = inicio; d <= termino; d = sumarDias(d, 1)) {
    const fecha = aTexto(d);
    const esRecepcion = fecha === recepcion;
    const inhabil = motivoInhabil(fecha);
    const habil = !esRecepcion && !inhabil ? ++contador : null;
    celdas.push({ fecha, habil, inhabil, esRecepcion });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

/** Fecha de hoy en Chile continental, como "AAAA-MM-DD". */
export function hoyEnChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
