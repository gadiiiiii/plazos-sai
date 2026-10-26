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
import { analizarSubsanacion, esperaSubsanacion } from "@/lib/subsanacion";
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

function generarICS(recepcion: string, vencimiento: string, prorroga: string, subsanacion?: string) {
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
    `DESCRIPTION:SAI recibida el ${recepcion}${subsanacion ? ` y subsanada el ${subsanacion}` : ""}.`,
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

function etiquetaCelda(c: DiaCalendario, subsanada: boolean) {
  const base = formatoLargo(c.fecha);
  if (c.esRecepcion) return `${base}: ${subsanada ? "subsanación" : "recepción"} de la solicitud`;
  if (c.inhabil)
    return `${base}: inhábil${c.inhabil.nombre ? `, ${c.inhabil.nombre}` : ""}`;
  const extra =
    c.habil === DIAS_PLAZO ? ", vencimiento" : c.habil === TOTAL ? ", vencimiento con prórroga" : "";
  return `${base}: día hábil ${c.habil}${extra}`;
}

function actualizarURL(clave: string, valor: string) {
  const url = new URL(window.location.href);
  if (valor && esFechaValida(valor)) url.searchParams.set(clave, valor);
  else url.searchParams.delete(clave);
  window.history.replaceState(null, "", url);
}

export default function Calculadora({
  recepcionInicial,
  hoy,
  terceroInicial,
  respuestaInicial,
  requerimientoInicial,
  subsanacionInicial,
}: {
  recepcionInicial: string;
  hoy: string;
  terceroInicial: string;
  respuestaInicial: string;
  requerimientoInicial: string;
  subsanacionInicial: string;
}) {
  const [recepcion, setRecepcion] = useState(recepcionInicial);
  const [requerimiento, setRequerimiento] = useState(requerimientoInicial);
  const [subsanacion, setSubsanacion] = useState(subsanacionInicial);
  const [copiado, setCopiado] = useState(false);
  const valida = esFechaValida(recepcion);

  const analisis = useMemo(
    () => (valida ? analizarSubsanacion(recepcion, { requerimiento, subsanacion }) : null),
    [recepcion, requerimiento, subsanacion, valida],
  );
  const sub = analisis?.subsanacion;
  const inicio = sub?.inicio ?? null;
  const subsanada = sub?.tipo === "subsanada";

  const resultado = useMemo(() => (inicio ? calcularPlazo(inicio, hoy) : null), [inicio, hoy]);
  const calendario = useMemo(
    () => (resultado && inicio ? construirCalendario(inicio, resultado.vencimientoProrroga) : []),
    [inicio, resultado],
  );

  function cambiar(valor: string) {
    setRecepcion(valor);
    setCopiado(false);
    if (esFechaValida(valor)) actualizarURL("recepcion", valor);
  }

  function cambiarRequerimiento(valor: string) {
    setRequerimiento(valor);
    setCopiado(false);
    actualizarURL("requerimiento", valor);
  }

  function cambiarSubsanacion(valor: string) {
    setSubsanacion(valor);
    setCopiado(false);
    actualizarURL("subsanacion", valor);
  }

  async function copiar() {
    if (!resultado) return;
    const origen = subsanada
      ? `SAI recibida el ${formatoLargo(recepcion)} y subsanada el ${formatoLargo(inicio!)}.`
      : `SAI recibida el ${formatoLargo(recepcion)}.`;
    const texto = `${origen} Vence el ${formatoLargo(resultado.vencimiento)} (con prórroga: ${formatoLargo(resultado.vencimientoProrroga)}).`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function descargar() {
    if (!resultado) return;
    const ics = generarICS(
      recepcion,
      resultado.vencimiento,
      resultado.vencimientoProrroga,
      subsanada ? inicio! : undefined,
    );
    const blob = new Blob([ics], {
      type: "text/calendar;charset=utf-8",
    });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `plazo-sai-${recepcion}.ics`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  const aviso = resultado ? estado(resultado.diasRestantes ?? 0, resultado.diasRestantesProrroga ?? 0) : null;
  const espera = sub?.tipo === "esperando" ? esperaSubsanacion(sub.limite, hoy) : null;
  const abrirSubsanacion = Boolean(requerimientoInicial || subsanacionInicial);

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

        <details className="subsanacion" open={abrirSubsanacion}>
          <summary>¿Se pidió subsanar la solicitud?</summary>
          <p className="ayuda-subsanacion">
            Si la solicitud no cumplía los requisitos, el solicitante tiene 5 días hábiles para
            subsanar y los 20 días hábiles empiezan a correr desde que lo hace (art.&nbsp;12, Ley
            20.285, e Instrucción General N°10 del CPLT).
          </p>
          <div className="opcionales">
            <div className="campo-opcional">
              <label htmlFor="requerimiento">Requerimiento notificado al solicitante</label>
              <div className="fila-campo">
                <input
                  id="requerimiento"
                  type="date"
                  value={requerimiento}
                  min={valida ? recepcion : undefined}
                  onChange={(e) => cambiarRequerimiento(e.target.value)}
                />
                {requerimiento && (
                  <button type="button" className="enlace" onClick={() => cambiarRequerimiento("")}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
            <div className="campo-opcional">
              <label htmlFor="subsanacion">El solicitante subsanó el</label>
              <div className="fila-campo">
                <input
                  id="subsanacion"
                  type="date"
                  value={subsanacion}
                  min={requerimiento || undefined}
                  onChange={(e) => cambiarSubsanacion(e.target.value)}
                />
                {subsanacion && (
                  <button type="button" className="enlace" onClick={() => cambiarSubsanacion("")}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
        </details>
      </section>

      {analisis?.avisos.map((a) => (
        <p key={a} className="estado estado-alerta aviso-suelto" role="status">
          {a}
        </p>
      ))}

      {sub?.tipo === "esperando" && espera && (
        <section className="resultado" aria-live="polite">
          <div className="fechas">
            <div>
              <h2>Puede subsanar hasta</h2>
              <p className="fecha-grande">{formatoLargo(sub.limite)}</p>
            </div>
          </div>
          {espera.desistida ? (
            <p className="estado estado-alerta">
              Venció el plazo para subsanar: se tiene al solicitante por desistido de su solicitud
              (art. 12, Ley 20.285).
            </p>
          ) : (
            <p className="estado estado-ok">
              {espera.diasRestantes === 0
                ? "Hoy es el último día para subsanar."
                : `Al solicitante le ${espera.diasRestantes === 1 ? "queda" : "quedan"} ${dias(espera.diasRestantes)} para subsanar.`}{" "}
              El plazo de 20 días hábiles todavía no corre: empieza cuando subsane.
            </p>
          )}
        </section>
      )}

      {valida && !resultado && (
        <Hitos
          recepcion={recepcion}
          hoy={hoy}
          terceroInicial={terceroInicial}
          respuestaInicial={respuestaInicial}
          requerimiento={requerimiento}
          subsanacion={subsanacion}
        />
      )}

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
            {subsanada && (
              <p className="desde-subsanacion">
                Contado desde la subsanación del {formatoLargo(inicio!)}, no desde la recepción
                (Instrucción General N°10 del CPLT, numeral 2.2).
              </p>
            )}
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

          <Hitos
            recepcion={recepcion}
            hoy={hoy}
            terceroInicial={terceroInicial}
            respuestaInicial={respuestaInicial}
            requerimiento={requerimiento}
            subsanacion={subsanacion}
          />

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
                          <td key={c.fecha} className={clases} title={c.inhabil?.nombre} aria-label={etiquetaCelda(c, subsanada)}>
                            <span className="fecha-dia">{dia === 1 || c.esRecepcion ? formatoCorto(c.fecha) : dia}</span>
                            <span className="contador">{c.esRecepcion ? (subsanada ? "S" : "R") : (c.habil ?? "")}</span>
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
              {subsanada && <li><strong>S</strong> Subsanación</li>}
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
