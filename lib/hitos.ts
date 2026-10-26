import { calcularPlazo, esFechaValida, sumarDiasHabiles } from "./plazos";

/**
 * Hitos del procedimiento de una SAI, además del vencimiento.
 *
 * - Art. 20, Ley 20.285: si la información puede afectar derechos de terceros,
 *   el órgano debe comunicárselo por carta certificada dentro de 2 días hábiles
 *   desde la recepción. El tercero tiene 3 días hábiles desde la notificación
 *   para oponerse.
 * - Art. 46, Ley 19.880: la notificación por carta certificada se entiende
 *   practicada desde el tercer día siguiente a su recepción en Correos.
 * - Art. 14, Ley 20.285: la prórroga debe comunicarse antes del vencimiento.
 * - Art. 24, Ley 20.285: el solicitante tiene 15 días para reclamar ante el
 *   Consejo para la Transparencia, desde que se le notifica la denegación o
 *   desde que vence el plazo sin respuesta. Se cuentan como días hábiles
 *   (art. 25, Ley 19.880).
 */

export const DIAS_COMUNICAR_TERCEROS = 2;
export const DIAS_CARTA_CERTIFICADA = 3;
export const DIAS_OPOSICION_TERCEROS = 3;
export const DIAS_AMPARO = 15;

export type IdHito =
  | "comunicar-terceros"
  | "notificacion-terceros"
  | "oposicion-terceros"
  | "aviso-prorroga"
  | "amparo-sin-respuesta"
  | "amparo-sin-respuesta-prorroga"
  | "amparo-respuesta";

export interface Hito {
  id: IdHito;
  fecha: string;
  titulo: string;
  detalle: string;
  norma: string;
}

export interface OpcionesHitos {
  /** Fecha en que la carta certificada al tercero se entregó en Correos. */
  entregaCorreosTercero?: string;
  /** Fecha en que se notificó la respuesta (o denegación) al solicitante. */
  notificacionRespuesta?: string;
}

export interface ResultadoHitos {
  hitos: Hito[];
  /** Avisos sobre los datos opcionales (por ejemplo, carta enviada fuera de plazo). */
  avisos: string[];
}

export function calcularHitos(recepcion: string, opciones: OpcionesHitos = {}): ResultadoHitos {
  const { vencimiento, vencimientoProrroga } = calcularPlazo(recepcion);
  const limiteTerceros = sumarDiasHabiles(recepcion, DIAS_COMUNICAR_TERCEROS);
  const avisos: string[] = [];

  const hitos: Hito[] = [
    {
      id: "comunicar-terceros",
      fecha: limiteTerceros,
      titulo: "Último día para comunicar a terceros",
      detalle:
        "Si la información puede afectar derechos de terceros, envíales carta certificada a más tardar este día.",
      norma: "Art. 20, Ley 20.285",
    },
    {
      id: "aviso-prorroga",
      fecha: vencimiento,
      titulo: "Plazo para avisar una prórroga",
      detalle:
        "La prórroga y sus fundamentos deben comunicarse al solicitante antes de que termine este día.",
      norma: "Art. 14, Ley 20.285",
    },
    {
      id: "amparo-sin-respuesta",
      fecha: sumarDiasHabiles(vencimiento, DIAS_AMPARO),
      titulo: "Fin del plazo de amparo si no hubo respuesta",
      detalle:
        "Sin respuesta ni prórroga, el solicitante puede reclamar ante el Consejo para la Transparencia hasta este día.",
      norma: "Art. 24, Ley 20.285",
    },
    {
      id: "amparo-sin-respuesta-prorroga",
      fecha: sumarDiasHabiles(vencimientoProrroga, DIAS_AMPARO),
      titulo: "Fin del plazo de amparo si hubo prórroga y no hubo respuesta",
      detalle:
        "Si se prorrogó y aun así no se respondió, el solicitante puede reclamar hasta este día.",
      norma: "Art. 24, Ley 20.285",
    },
  ];

  const { entregaCorreosTercero: entrega, notificacionRespuesta: respuesta } = opciones;

  if (entrega && esFechaValida(entrega)) {
    if (entrega < recepcion) {
      avisos.push("La carta al tercero no puede entregarse en Correos antes de la recepción de la solicitud.");
    } else {
      if (entrega > limiteTerceros) {
        avisos.push("La carta al tercero se entregó en Correos después del plazo de 2 días hábiles.");
      }
      const notificacion = sumarDiasHabiles(entrega, DIAS_CARTA_CERTIFICADA);
      hitos.push(
        {
          id: "notificacion-terceros",
          fecha: notificacion,
          titulo: "El tercero se entiende notificado",
          detalle: "La carta certificada produce efecto desde el tercer día siguiente a su recepción en Correos.",
          norma: "Art. 46, Ley 19.880",
        },
        {
          id: "oposicion-terceros",
          fecha: sumarDiasHabiles(notificacion, DIAS_OPOSICION_TERCEROS),
          titulo: "Último día para que el tercero se oponga",
          detalle:
            "Si no se opone por escrito hasta este día, se entiende que accede a que se entregue la información.",
          norma: "Art. 20, Ley 20.285",
        },
      );
    }
  }

  if (respuesta && esFechaValida(respuesta)) {
    if (respuesta < recepcion) {
      avisos.push("La respuesta no puede notificarse antes de la recepción de la solicitud.");
    } else {
      hitos.push({
        id: "amparo-respuesta",
        fecha: sumarDiasHabiles(respuesta, DIAS_AMPARO),
        titulo: "Fin del plazo de amparo contra la respuesta",
        detalle:
          "Si la respuesta denegó la información, total o parcialmente, el solicitante puede reclamar hasta este día.",
        norma: "Art. 24, Ley 20.285",
      });
    }
  }

  hitos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { hitos, avisos };
}
