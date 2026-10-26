import { calcularHitos } from "@/lib/hitos";
import { calcularPlazo, esFechaValida, hoyEnChile } from "@/lib/plazos";
import { analizarSubsanacion } from "@/lib/subsanacion";

const OPCIONALES = ["hoy", "tercero", "respuesta", "requerimiento", "subsanacion"] as const;

/**
 * GET /api/plazo?recepcion=AAAA-MM-DD
 *   [&hoy=…][&tercero=…][&respuesta=…][&requerimiento=…][&subsanacion=…]
 *
 * Devuelve los vencimientos y los hitos del procedimiento de una SAI en JSON.
 * Si se pidió subsanar y aún no se subsana, el plazo del art. 14 no corre y los
 * campos de vencimiento vienen en null.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const recepcion = params.get("recepcion");

  if (!recepcion || !esFechaValida(recepcion)) {
    return Response.json(
      { error: "Falta el parámetro recepcion o no tiene formato AAAA-MM-DD." },
      { status: 400 },
    );
  }
  for (const nombre of OPCIONALES) {
    const valor = params.get(nombre);
    if (valor !== null && !esFechaValida(valor)) {
      return Response.json({ error: `El parámetro ${nombre} debe tener formato AAAA-MM-DD.` }, { status: 400 });
    }
  }

  const opcional = (nombre: (typeof OPCIONALES)[number]) => params.get(nombre) ?? undefined;
  const hoy = opcional("hoy") ?? hoyEnChile();

  const { subsanacion, avisos: avisosSubsanacion } = analizarSubsanacion(recepcion, {
    requerimiento: opcional("requerimiento"),
    subsanacion: opcional("subsanacion"),
  });
  const plazo = subsanacion.inicio ? calcularPlazo(subsanacion.inicio, hoy) : null;
  const { hitos, avisos } = calcularHitos(recepcion, {
    entregaCorreosTercero: opcional("tercero"),
    notificacionRespuesta: opcional("respuesta"),
    requerimientoSubsanacion: opcional("requerimiento"),
    subsanacion: opcional("subsanacion"),
  });

  return Response.json({
    recepcion,
    hoy,
    inicioComputo: subsanacion.inicio,
    subsanacion,
    vencimiento: plazo?.vencimiento ?? null,
    vencimientoProrroga: plazo?.vencimientoProrroga ?? null,
    diasRestantes: plazo?.diasRestantes ?? null,
    diasRestantesProrroga: plazo?.diasRestantesProrroga ?? null,
    feriadosEnRango: plazo?.feriadosEnRango ?? [],
    fueraDeCobertura: plazo?.fueraDeCobertura ?? false,
    hitos,
    avisos: [...avisosSubsanacion, ...avisos],
  });
}
