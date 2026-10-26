/**
 * Feriados nacionales de Chile (Ley 2.977 y modificaciones).
 * Solo se incluyen feriados de alcance nacional: los regionales
 * (por ejemplo, 7 de junio en Arica o 20 de agosto en Chillán) no se consideran.
 *
 * Formato: "AAAA-MM-DD".
 * Para agregar un año nuevo, añade sus fechas y actualiza AÑOS_CUBIERTOS.
 */
export interface Feriado {
  fecha: string;
  nombre: string;
}

export const FERIADOS: Feriado[] = [
  // ── 2025 ──
  { fecha: "2025-01-01", nombre: "Año Nuevo" },
  { fecha: "2025-04-18", nombre: "Viernes Santo" },
  { fecha: "2025-04-19", nombre: "Sábado Santo" },
  { fecha: "2025-05-01", nombre: "Día del Trabajo" },
  { fecha: "2025-05-21", nombre: "Día de las Glorias Navales" },
  { fecha: "2025-06-20", nombre: "Día Nacional de los Pueblos Indígenas" },
  { fecha: "2025-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2025-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2025-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2025-09-18", nombre: "Independencia Nacional" },
  { fecha: "2025-09-19", nombre: "Día de las Glorias del Ejército" },
  { fecha: "2025-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2025-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes" },
  { fecha: "2025-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2025-11-16", nombre: "Elecciones presidencial y parlamentarias" },
  { fecha: "2025-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2025-12-14", nombre: "Segunda vuelta presidencial" },
  { fecha: "2025-12-25", nombre: "Navidad" },

  // ── 2026 ──
  { fecha: "2026-01-01", nombre: "Año Nuevo" },
  { fecha: "2026-04-03", nombre: "Viernes Santo" },
  { fecha: "2026-04-04", nombre: "Sábado Santo" },
  { fecha: "2026-05-01", nombre: "Día del Trabajo" },
  { fecha: "2026-05-21", nombre: "Día de las Glorias Navales" },
  { fecha: "2026-06-21", nombre: "Día Nacional de los Pueblos Indígenas" },
  { fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2026-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2026-09-18", nombre: "Independencia Nacional" },
  { fecha: "2026-09-19", nombre: "Día de las Glorias del Ejército" },
  { fecha: "2026-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2026-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes" },
  { fecha: "2026-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2026-12-25", nombre: "Navidad" },

  // ── 2027 (provisorio: revisar el decreto del Día de los Pueblos Indígenas y posibles elecciones) ──
  { fecha: "2027-01-01", nombre: "Año Nuevo" },
  { fecha: "2027-03-26", nombre: "Viernes Santo" },
  { fecha: "2027-03-27", nombre: "Sábado Santo" },
  { fecha: "2027-05-01", nombre: "Día del Trabajo" },
  { fecha: "2027-05-21", nombre: "Día de las Glorias Navales" },
  { fecha: "2027-06-21", nombre: "Día Nacional de los Pueblos Indígenas" },
  { fecha: "2027-06-28", nombre: "San Pedro y San Pablo" },
  { fecha: "2027-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2027-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2027-09-18", nombre: "Independencia Nacional" },
  { fecha: "2027-09-19", nombre: "Día de las Glorias del Ejército" },
  { fecha: "2027-10-11", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2027-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes" },
  { fecha: "2027-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2027-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2027-12-25", nombre: "Navidad" },
];

export const AÑOS_CUBIERTOS = [2025, 2026, 2027];

export const MAPA_FERIADOS: ReadonlyMap<string, string> = new Map(
  FERIADOS.map((f) => [f.fecha, f.nombre]),
);
