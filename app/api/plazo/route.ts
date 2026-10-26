import { calcularPlazo, esFechaValida, hoyEnChile } from "@/lib/plazos";

/**
 * GET /api/plazo?recepcion=AAAA-MM-DD[&hoy=AAAA-MM-DD]
 * Devuelve los vencimientos de una SAI en JSON.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const recepcion = params.get("recepcion");
  const hoy = params.get("hoy") ?? hoyEnChile();

  if (!recepcion || !esFechaValida(recepcion)) {
    return Response.json(
      { error: "Falta el parámetro recepcion o no tiene formato AAAA-MM-DD." },
      { status: 400 },
    );
  }
  if (!esFechaValida(hoy)) {
    return Response.json({ error: "El parámetro hoy debe tener formato AAAA-MM-DD." }, { status: 400 });
  }

  return Response.json({ ...calcularPlazo(recepcion, hoy), hoy });
}
