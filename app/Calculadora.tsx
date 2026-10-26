"use client";

import { useMemo, useState } from "react";
import {
  calcularPlazo,
  construirCalendario,
  esFechaValida,
  DIAS_PLAZO,
  DIAS_PRORROGA,
  type DiaCalendario,
} from "@/lib/plazos";
import Hitos from "./Hitos";

const TOTAL = DIAS_PLAZO + DIAS_PRORROGA;
const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function aUTC(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function formatoLargo(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(aUTC(fecha));
}

function formatoCorto(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(aUTC(fecha))
    .replace(".", "");
}

function dias(n: number) {
  return `${n} ${n === 1 ? "día hábil" : "días hábiles"}`;
}

function estado(restantes: number, restantesProrroga: number) {
  if (restantes > 0) return { tono: "ok", texto: `Quedan ${dias(restantes)} para responder.` };
  if (restantes === 0) return { tono: "alerta", texto: "El plazo vence hoy." };
  if (restantesProrroga > 0)
    return {
      tono: "alerta",
      texto: `El plazo normal venció hace ${dias(-restantes)}. Si se prorrogó a tiempo, quedan ${dias(restantesProrroga)}.`,
    };
  if (restantesProrroga === 0)
    return { tono: "alerta", texto: "El plazo normal ya venció y el de la prórroga vence hoy." };
  return { tono: "vencido", texto: `El plazo con prórroga venció hace ${dias(-restantesProrroga)}.` };
}

function generarICS(recepcion: string, vencimiento: string, prorroga: string) {
  const compacto = (f: string) => f.replaceAll("-", "");
  const siguiente = (f: string) => {
    const d = aUTC(f);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const evento = (fecha: string, titulo: string, id: string) => [
    "BEGIN:VEVENT",
    `UID:${id}-${compacto(recepcion)}@plazos-sai`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${compacto(fecha)}`,
    `DTEND;VALUE=DATE:${compacto(siguiente(fecha))}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:SAI recibida el ${recepcion}.`,
    "END:VEVENT",
  ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plazos SAI//ES",
    ...evento(vencimiento, "Vence SAI (20 días hábiles)", "plazo"),
    ...evento(prorroga, "Vence SAI con prórroga (30 días hábiles)", "prorroga"),
    "END:VCALENDAR",
  ].join("\r\n");
}

function etiquetaCelda(c: DiaCalendario) {
  const base = formatoLargo(c.fecha);
  if (c.esRecepcion) return `${base}: recepción de la solicitud`;
  if (c.inhabil)
    return `${base}: inhábil${c.inhabil.nombre ? `, ${c.inhabil.nombre}` : ""}`;
  const extra =
    c.habil === DIAS_PLAZO ? ", vencimiento" : c.habil === TOTAL ? ", vencimiento con prórroga" : "";
  return `${base}: día hábil ${c.habil}${extra}`;
}

export default function Calculadora({
  recepcionInicial,
  hoy,
  terceroInicial,
  respuestaInicial,
}: {
  recepcionInicial: string;
  hoy: string;
  terceroInicial: string;
  respuestaInicial: string;
}) {
  const [recepcion, setRecepcion] = useState(recepcionInicial);
  const [copiado, setCopiado] = useState(false);
  const valida = esFechaValida(recepcion);

  const resultado = useMemo(() => (valida ? calcularPlazo(recepcion, hoy) : null), [recepcion, hoy, valida]);
  const calendario = useMemo(
    () => (resultado ? construirCalendario(recepcion, resultado.vencimientoProrroga) : []),
    [recepcion, resultado],
  );

  function cambiar(valor: string) {
    setRecepcion(valor);
    setCopiado(false);
    if (esFechaValida(valor)) {
      const url = new URL(window.location.href);
      url.searchParams.set("recepcion", valor);
      window.history.replaceState(null, "", url);
    }
  }

  async function copiar() {
    if (!resultado) return;
    const texto = `SAI recibida el ${formatoLargo(recepcion)}. Vence el ${formatoLargo(resultado.vencimiento)} (con prórroga: ${formatoLargo(resultado.vencimientoProrroga)}).`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function descargar() {
    if (!resultado) return;
    const blob = new Blob([generarICS(recepcion, resultado.vencimiento, resultado.vencimientoProrroga)], {
      type: "text/calendar;charset=utf-8",
    });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `plazo-sai-${recepcion}.ics`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  const aviso = resultado ? estado(resultado.diasRestantes ?? 0, resultado.diasRestantesProrroga ?? 0) : null;

  return (
    <>
      <section className="formulario">
        <label htmlFor="recepcion">Fecha de recepción</label>
        <div className="fila-campo">
          <input
            id="recepcion"
            type="date"
            value={recepcion}
            onChange={(e) => cambiar(e.target.value)}
            aria-describedby="ayuda-recepcion"
          />
          {recepcion !== hoy && (
            <button type="button" className="enlace" onClick={() => cambiar(hoy)}>
              Usar hoy
            </button>
          )}
        </div>
        <p id="ayuda-recepcion" className="ayuda">
          {valida ? "El conteo parte el día hábil siguiente." : "Ingresa una fecha válida."}
        </p>
      </section>

      {resultado && aviso && (
        <>
          <section className="resultado" aria-live="polite">
            <div className="fechas">
              <div>
                <h2>Vence</h2>
                <p className="fecha-grande">{formatoLargo(resultado.vencimiento)}</p>
              </div>
              <div className="secundaria">
                <h2>Con prórroga</h2>
                <p className="fecha-grande">{formatoLargo(resultado.vencimientoProrroga)}</p>
              </div>
            </div>
            <p className={`estado estado-${aviso.tono}`}>{aviso.texto}</p>
            {resultado.fueraDeCobertura && (
              <p className="estado estado-alerta">
                Parte del cálculo cae en un año sin feriados cargados: el resultado solo descuenta
                fines de semana.
              </p>
            )}
            <div className="acciones">
              <button type="button" onClick={copiar}>
                {copiado ? "Texto copiado" : "Copiar texto"}
              </button>
              <button type="button" onClick={descargar}>
                Agregar al calendario (.ics)
              </button>
            </div>
          </section>

          <Hitos recepcion={recepcion} hoy={hoy} terceroInicial={terceroInicial} respuestaInicial={respuestaInicial} />

          <section className="calendario" aria-labelledby="titulo-calendario">
            <h2 id="titulo-calendario">Los 30 días hábiles, uno por uno</h2>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    {SEMANA.map((d) => (
                      <th key={d} scope="col">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: calendario.length / 7 }, (_, s) => (
                    <tr key={s}>
                      {calendario.slice(s * 7, s * 7 + 7).map((c, i) => {
                        if (!c) return <td key={i} className="vacio" />;
                        const dia = Number(c.fecha.slice(8));
                        const clases = [
                          "dia",
                          c.inhabil && "inhabil",
                          c.inhabil?.motivo === "feriado" && "feriado",
                          c.esRecepcion && "recepcion",
                          c.habil === DIAS_PLAZO && "vence",
                          c.habil === TOTAL && "vence-prorroga",
                          c.habil && c.habil > DIAS_PLAZO && "prorroga",
                          c.fecha === hoy && "hoy",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <td key={c.fecha} className={clases} title={c.inhabil?.nombre} aria-label={etiquetaCelda(c)}>
                            <span className="fecha-dia">{dia === 1 || c.esRecepcion ? formatoCorto(c.fecha) : dia}</span>
                            <span className="contador">{c.esRecepcion ? "R" : (c.habil ?? "")}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="leyenda">
              <li><span className="muestra muestra-vence" /> Día 20: vencimiento</li>
              <li><span className="muestra muestra-prorroga" /> Días 21 a 30: prórroga</li>
              <li><span className="muestra muestra-inhabil" /> Inhábil</li>
              <li><span className="muestra muestra-hoy" /> Hoy</li>
            </ul>
            {resultado.feriadosEnRango.length > 0 && (
              <p className="feriados">
                Feriados descontados:{" "}
                {resultado.feriadosEnRango
                  .map((f) => `${formatoCorto(f.fecha)} (${f.nombre})`)
                  .join(", ")}
                .
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
