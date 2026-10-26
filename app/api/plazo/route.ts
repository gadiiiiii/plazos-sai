import { calcularHitos } from "@/lib/hitos";
import { calcularPlazo, esFechaValida, hoyEnChile } from "@/lib/plazos";

/**
 * GET /api/plazo?recepcion=AAAA-MM-DD[&hoy=AAAA-MM-DD][&tercero=AAAA-MM-DD][&respuesta=AAAA-MM-DD]
 * Devuelve los vencimientos y los hitos del procedimiento de una SAI en JSON.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const recepcion = params.get("recepcion");
  const hoy = params.get("hoy") ?? hoyEnChile();
  const tercero = params.get("tercero");
  const respuesta = params.get("respuesta");

  if (!recepcion || !esFechaValida(recepcion)) {
    return Response.json(
      { error: "Falta el parámetro recepcion o no tiene formato AAAA-MM-DD." },
      { status: 400 },
    );
  }
  for (const [nombre, valor] of [["hoy", hoy], ["tercero", tercero], ["respuesta", respuesta]] as const) {
    if (valor !== null && !esFechaValida(valor)) {
      return Response.json({ error: `El parámetro ${nombre} debe tener formato AAAA-MM-DD.` }, { status: 400 });
    }
  }

  const { hitos, avisos } = calcularHitos(recepcion, {
    entregaCorreosTercero: tercero ?? undefined,
    notificacionRespuesta: respuesta ?? undefined,
  });

  return Response.json({ ...calcularPlazo(recepcion, hoy), hoy, hitos, avisos });
}
