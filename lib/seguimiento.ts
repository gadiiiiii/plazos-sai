import { DIAS_AMPARO } from "./hitos";
import { calcularPlazo, diasHabilesEntre, esFechaValida, sumarDiasHabiles } from "./plazos";

/**
 * Seguimiento de varias SAI a la vez: estado de cada una respecto de hoy,
 * orden por urgencia, carga desde texto pegado (Excel) y exportación a CSV.
 */

/** Días hábiles restantes desde los cuales una SAI se considera "vence pronto". */
export const DIAS_PRONTO = 5;

export interface Solicitud {
  id: string;
  folio: string;
  recepcion: string;
  prorrogada: boolean;
  /** Fecha en que se notificó la respuesta, si ya se respondió. */
  respuesta?: string;
}

export type Grupo = "vencida" | "pronto" | "al-dia" | "respondida";

export const ORDEN_GRUPOS: Grupo[] = ["vencida", "pronto", "al-dia", "respondida"];

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  vencida: "Vencidas",
  pronto: "Vencen pronto",
  "al-dia": "Al día",
  respondida: "Respondidas",
};

/** Estado de una sola solicitud, para la tabla y el CSV. */
export const ESTADO: Record<Grupo, string> = {
  vencida: "Vencida",
  pronto: "Vence pronto",
  "al-dia": "Al día",
  respondida: "Respondida",
};

export interface Evaluacion {
  grupo: Grupo;
  /** Vencimiento que aplica: con prórroga si se prorrogó. */
  vence: string;
  /** Días hábiles hasta `vence` (negativo si venció). null si ya se respondió. */
  diasRestantes: number | null;
  /** true si la respuesta se notificó después del vencimiento. */
  fueraDePlazo: boolean;
  /** Último día para reclamar ante el CPLT contra la respuesta. */
  amparoHasta?: string;
}

export function evaluar(s: Solicitud, hoy: string): Evaluacion {
  const plazo = calcularPlazo(s.recepcion);
  const vence = s.prorrogada ? plazo.vencimientoProrroga : plazo.vencimiento;

  if (s.respuesta) {
    return {
      grupo: "respondida",
      vence,
      diasRestantes: null,
      fueraDePlazo: s.respuesta > vence,
      amparoHasta: sumarDiasHabiles(s.respuesta, DIAS_AMPARO),
    };
  }

  const diasRestantes = diasHabilesEntre(hoy, vence);
  const grupo: Grupo = diasRestantes < 0 ? "vencida" : diasRestantes <= DIAS_PRONTO ? "pronto" : "al-dia";
  return { grupo, vence, diasRestantes, fueraDePlazo: false };
}

/**
 * Ordena por urgencia: vencidas (la más atrasada primero), vencen pronto y al día
 * (la más próxima primero), respondidas (la más reciente primero).
 */
export function ordenarPorUrgencia(lista: Solicitud[], hoy: string) {
  return lista
    .map((solicitud) => ({ solicitud, evaluacion: evaluar(solicitud, hoy) }))
    .sort((a, b) => {
      const g = ORDEN_GRUPOS.indexOf(a.evaluacion.grupo) - ORDEN_GRUPOS.indexOf(b.evaluacion.grupo);
      if (g !== 0) return g;
      if (a.evaluacion.grupo === "respondida") {
        return (b.solicitud.respuesta ?? "").localeCompare(a.solicitud.respuesta ?? "");
      }
      const d = a.evaluacion.vence.localeCompare(b.evaluacion.vence);
      return d !== 0 ? d : a.solicitud.folio.localeCompare(b.solicitud.folio);
    });
}

export function contarPorGrupo(lista: Solicitud[], hoy: string): Record<Grupo, number> {
  const conteo: Record<Grupo, number> = { vencida: 0, pronto: 0, "al-dia": 0, respondida: 0 };
  for (const s of lista) conteo[evaluar(s, hoy).grupo]++;
  return conteo;
}

/**
 * Interpreta una fecha escrita a mano o copiada desde Excel.
 * Acepta AAAA-MM-DD, DD-MM-AAAA, DD/MM/AAAA, DD.MM.AAAA y años de 2 dígitos (20AA).
 */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  const cl = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t);
  if (iso) {
    [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (cl) {
    [d, m, a] = [Number(cl[1]), Number(cl[2]), Number(cl[3])];
    if (cl[3].length === 2) a += 2000;
  } else {
    return null;
  }

  const fecha = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return esFechaValida(fecha) ? fecha : null;
}

export interface FilaPegada {
  folio: string;
  recepcion: string;
  respuesta?: string;
}

export interface ResultadoPegado {
  filas: FilaPegada[];
  errores: string[];
}

/**
 * Lee filas pegadas desde una planilla. Cada fila necesita un folio y una fecha
 * de recepción; una segunda fecha se toma como fecha de respuesta. Las columnas
 * pueden venir separadas por tabulación, punto y coma o coma. Si la primera fila
 * no tiene fechas, se ignora como encabezado.
 */
export function parsearPegado(texto: string): ResultadoPegado {
  const filas: FilaPegada[] = [];
  const errores: string[] = [];
  const lineas = texto.split(/\r?\n/);

  lineas.forEach((linea, i) => {
    if (!linea.trim()) return;
    const partes = linea.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);
    const fechas: string[] = [];
    const textos: string[] = [];
    for (const p of partes) {
      const f = parsearFecha(p);
      if (f) fechas.push(f);
      else textos.push(p);
    }

    const n = i + 1;
    if (fechas.length === 0) {
      if (i === 0) return; // encabezado
      errores.push(`Línea ${n}: no encontré una fecha válida.`);
      return;
    }
    if (textos.length === 0) {
      errores.push(`Línea ${n}: falta el folio.`);
      return;
    }

    const [recepcion, respuesta] = fechas;
    if (respuesta && respuesta < recepcion) {
      errores.push(`Línea ${n}: la fecha de respuesta es anterior a la de recepción.`);
      return;
    }
    filas.push({ folio: textos[0], recepcion, ...(respuesta ? { respuesta } : {}) });
  });

  return { filas, errores };
}

/** Agrega solicitudes nuevas, saltándose los folios que ya existen (sin distinguir mayúsculas). */
export function agregarSinDuplicados(
  lista: Solicitud[],
  nuevas: Solicitud[],
): { lista: Solicitud[]; duplicados: string[] } {
  const clave = (folio: string) => folio.trim().toLowerCase();
  const existentes = new Set(lista.map((s) => clave(s.folio)));
  const duplicados: string[] = [];
  const resultado = [...lista];
  for (const s of nuevas) {
    if (existentes.has(clave(s.folio))) {
      duplicados.push(s.folio);
      continue;
    }
    existentes.add(clave(s.folio));
    resultado.push(s);
  }
  return { lista: resultado, duplicados };
}

/** Valida datos leídos del almacenamiento del navegador. */
export function esListaValida(datos: unknown): datos is Solicitud[] {
  return (
    Array.isArray(datos) &&
    datos.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof s.id === "string" &&
        typeof s.folio === "string" &&
        typeof s.recepcion === "string" &&
        esFechaValida(s.recepcion) &&
        typeof s.prorrogada === "boolean" &&
        (s.respuesta === undefined || (typeof s.respuesta === "string" && esFechaValida(s.respuesta))),
    )
  );
}

function fechaCL(fecha: string) {
  const [a, m, d] = fecha.split("-");
  return `${d}-${m}-${a}`;
}

function celdaCSV(valor: string) {
  return /[;"\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/**
 * CSV separado por punto y coma, con fechas DD-MM-AAAA, para que Excel en
 * español (Chile) lo abra en columnas sin configurar nada.
 */
export function aCSV(lista: Solicitud[], hoy: string): string {
  const encabezado = [
    "Folio",
    "Recepción",
    "Vence",
    "Vence con prórroga",
    "Prorrogada",
    "Respuesta",
    "Estado",
    "Días hábiles restantes",
    "Respondida fuera de plazo",
    "Amparo hasta",
  ];
  const filas = ordenarPorUrgencia(lista, hoy).map(({ solicitud: s, evaluacion: e }) => {
    const plazo = calcularPlazo(s.recepcion);
    return [
      s.folio,
      fechaCL(s.recepcion),
      fechaCL(plazo.vencimiento),
      fechaCL(plazo.vencimientoProrroga),
      s.prorrogada ? "Sí" : "No",
      s.respuesta ? fechaCL(s.respuesta) : "",
      ESTADO[e.grupo],
      e.diasRestantes === null ? "" : String(e.diasRestantes),
      s.respuesta ? (e.fueraDePlazo ? "Sí" : "No") : "",
      e.amparoHasta ? fechaCL(e.amparoHasta) : "",
    ];
  });
  return [encabezado, ...filas].map((f) => f.map(celdaCSV).join(";")).join("\r\n");
}
