import { diasHabilesEntre, esFechaValida, sumarDiasHabiles } from "./plazos";

/**
 * Subsanación de una solicitud que no cumple los requisitos.
 *
 * - Art. 12, Ley 20.285: se pide al solicitante que subsane en un plazo de
 *   5 días desde la notificación, bajo apercibimiento de tenerlo por desistido.
 * - Instrucción General N°10 del CPLT, numeral 2.2: el plazo es de 5 días
 *   hábiles y, si se subsana a tiempo, los plazos del art. 14 (20 días hábiles
 *   y la prórroga) recién empiezan a correr desde la subsanación.
 */

export const DIAS_SUBSANAR = 5;

export interface DatosSubsanacion {
  /** Fecha en que se notificó al solicitante el requerimiento de subsanar. */
  requerimiento?: string;
  /** Fecha en que el solicitante subsanó. */
  subsanacion?: string;
}

export type Subsanacion =
  /** No se pidió subsanar: el plazo corre desde la recepción. */
  | { tipo: "no-aplica"; inicio: string }
  /** Se pidió subsanar y todavía no se subsana: el plazo del art. 14 no corre. */
  | { tipo: "esperando"; requerimiento: string; limite: string; inicio: null }
  /** Se subsanó: el plazo corre desde la subsanación. */
  | {
      tipo: "subsanada";
      requerimiento: string;
      limite: string;
      subsanacion: string;
      inicio: string;
      /** true si se subsanó después de los 5 días hábiles. */
      fueraDePlazo: boolean;
    };

export interface ResultadoSubsanacion {
  subsanacion: Subsanacion;
  avisos: string[];
}

export function analizarSubsanacion(recepcion: string, datos: DatosSubsanacion = {}): ResultadoSubsanacion {
  const avisos: string[] = [];
  const requerimiento = datos.requerimiento && esFechaValida(datos.requerimiento) ? datos.requerimiento : undefined;
  const subsanacion = datos.subsanacion && esFechaValida(datos.subsanacion) ? datos.subsanacion : undefined;

  if (!requerimiento) {
    if (subsanacion) {
      avisos.push("Para usar la fecha de subsanación, ingresa también cuándo se notificó el requerimiento.");
    }
    return { subsanacion: { tipo: "no-aplica", inicio: recepcion }, avisos };
  }

  if (requerimiento < recepcion) {
    avisos.push("El requerimiento de subsanación no puede ser anterior a la recepción de la solicitud.");
    return { subsanacion: { tipo: "no-aplica", inicio: recepcion }, avisos };
  }

  const limite = sumarDiasHabiles(requerimiento, DIAS_SUBSANAR);

  if (!subsanacion) {
    return { subsanacion: { tipo: "esperando", requerimiento, limite, inicio: null }, avisos };
  }

  if (subsanacion < requerimiento) {
    avisos.push("La subsanación no puede ser anterior al requerimiento.");
    return { subsanacion: { tipo: "esperando", requerimiento, limite, inicio: null }, avisos };
  }

  const fueraDePlazo = subsanacion > limite;
  if (fueraDePlazo) {
    avisos.push(
      "La subsanación llegó después de los 5 días hábiles: según el art. 12 se tiene al solicitante por desistido. Si igual se tramita, el plazo se cuenta desde la subsanación.",
    );
  }

  return {
    subsanacion: { tipo: "subsanada", requerimiento, limite, subsanacion, inicio: subsanacion, fueraDePlazo },
    avisos,
  };
}

/** Para una solicitud en espera: días hábiles que le quedan al solicitante, o si ya se le tiene por desistido. */
export function esperaSubsanacion(limite: string, hoy: string) {
  const diasRestantes = diasHabilesEntre(hoy, limite);
  return { diasRestantes, desistida: diasRestantes < 0 };
}
