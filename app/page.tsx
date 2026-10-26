import Calculadora from "./Calculadora";
import Navegacion from "./Navegacion";
import { esFechaValida, hoyEnChile } from "@/lib/plazos";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    recepcion?: string;
    tercero?: string;
    respuesta?: string;
    requerimiento?: string;
    subsanacion?: string;
  }>;
}) {
  const { recepcion, tercero, respuesta, requerimiento, subsanacion } = await searchParams;
  const fecha = (f?: string) => (f && esFechaValida(f) ? f : "");
  const hoy = hoyEnChile();
  const inicial = recepcion && esFechaValida(recepcion) ? recepcion : hoy;

  return (
    <main>
      <Navegacion />
      <header className="cabecera">
        <h1>Plazos SAI</h1>
        <p>
          Ingresa la fecha en que llegó una solicitud de acceso a la información y te muestro
          cuándo vence: 20 días hábiles, más 10 si se prorroga (art.&nbsp;14, Ley&nbsp;20.285).
        </p>
      </header>
      <Calculadora
        recepcionInicial={inicial}
        hoy={hoy}
        terceroInicial={fecha(tercero)}
        respuestaInicial={fecha(respuesta)}
        requerimientoInicial={fecha(requerimiento)}
        subsanacionInicial={fecha(subsanacion)}
      />
      <footer className="pie">
        <p>
          Se cuentan días hábiles desde el día siguiente a la recepción, excluyendo sábados,
          domingos y feriados nacionales (art.&nbsp;1 N°3, Ley&nbsp;20.285, y art.&nbsp;25, Ley&nbsp;19.880). No considera feriados
          regionales ni la suspensión del plazo mientras se pagan costos de reproducción.
        </p>
        <p>
          Herramienta de apoyo: confirma siempre el plazo con tu procedimiento interno. API
          disponible en <code>/api/plazo?recepcion=AAAA-MM-DD</code>.
        </p>
      </footer>
    </main>
  );
}
