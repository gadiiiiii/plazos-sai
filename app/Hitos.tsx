"use client";

import { useMemo, useState } from "react";
import { calcularHitos, type Hito } from "@/lib/hitos";
import { diasHabilesEntre, esFechaValida } from "@/lib/plazos";

function aUTC(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

const fmtDia = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtSemana = new Intl.DateTimeFormat("es-CL", { weekday: "long", timeZone: "UTC" });
const fmtAño = new Intl.DateTimeFormat("es-CL", { year: "numeric", timeZone: "UTC" });

function cuando(hoy: string, fecha: string) {
  if (fecha === hoy) return { clase: "hoy", texto: "Hoy" };
  const n = diasHabilesEntre(hoy, fecha);
  if (fecha < hoy) return { clase: "pasado", texto: "Ya pasó" };
  if (n === 0) return { clase: "proximo", texto: "Próximo día hábil" };
  return { clase: "proximo", texto: `En ${n} ${n === 1 ? "día hábil" : "días hábiles"}` };
}

function actualizarURL(clave: string, valor: string) {
  const url = new URL(window.location.href);
  if (valor && esFechaValida(valor)) url.searchParams.set(clave, valor);
  else url.searchParams.delete(clave);
  window.history.replaceState(null, "", url);
}

function CampoOpcional({
  id,
  etiqueta,
  ayuda,
  valor,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  valor: string;
  onCambio: (v: string) => void;
}) {
  return (
    <div className="campo-opcional">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="fila-campo">
        <input id={id} type="date" value={valor} onChange={(e) => onCambio(e.target.value)} aria-describedby={`${id}-ayuda`} />
        {valor && (
          <button type="button" className="enlace" onClick={() => onCambio("")}>
            Quitar
          </button>
        )}
      </div>
      <p id={`${id}-ayuda`} className="ayuda">
        {ayuda}
      </p>
    </div>
  );
}

function FilaHito({ hito, hoy }: { hito: Hito; hoy: string }) {
  const estado = cuando(hoy, hito.fecha);
  const fecha = aUTC(hito.fecha);
  const otroAño = hito.fecha.slice(0, 4) !== hoy.slice(0, 4);
  return (
    <li className={`hito hito-${estado.clase}`}>
      <div className="hito-fecha">
        <span className="hito-dia">{fmtDia.format(fecha).replace(".", "")}</span>
        <span className="hito-semana">
          {fmtSemana.format(fecha)}
          {otroAño && ` ${fmtAño.format(fecha)}`}
        </span>
      </div>
      <div className="hito-cuerpo">
        <h3>{hito.titulo}</h3>
        <p>{hito.detalle}</p>
        <p className="hito-meta">
          <span className={`hito-estado estado-${estado.clase}`}>{estado.texto}</span>
          <span className="hito-norma">{hito.norma}</span>
        </p>
      </div>
    </li>
  );
}

export default function Hitos({
  recepcion,
  hoy,
  terceroInicial,
  respuestaInicial,
  requerimiento,
  subsanacion,
}: {
  recepcion: string;
  hoy: string;
  terceroInicial: string;
  respuestaInicial: string;
  requerimiento: string;
  subsanacion: string;
}) {
  const [tercero, setTercero] = useState(terceroInicial);
  const [respuesta, setRespuesta] = useState(respuestaInicial);

  const { hitos, avisos } = useMemo(
    () =>
      calcularHitos(recepcion, {
        entregaCorreosTercero: tercero,
        notificacionRespuesta: respuesta,
        requerimientoSubsanacion: requerimiento,
        subsanacion,
      }),
    [recepcion, tercero, respuesta, requerimiento, subsanacion],
  );

  return (
    <section className="hitos" aria-labelledby="titulo-hitos">
      <h2 id="titulo-hitos">Hitos del procedimiento</h2>
      <p className="hitos-intro">
        Fechas que conviene tener a la vista además del vencimiento. Si hubo carta a terceros o
        ya notificaste la respuesta, ingresa la fecha y se agregan sus plazos.
      </p>

      <div className="opcionales">
        <CampoOpcional
          id="tercero"
          etiqueta="Carta a terceros entregada en Correos"
          ayuda="Para calcular hasta cuándo puede oponerse el tercero."
          valor={tercero}
          onCambio={(v) => {
            setTercero(v);
            actualizarURL("tercero", v);
          }}
        />
        <CampoOpcional
          id="respuesta"
          etiqueta="Respuesta notificada al solicitante"
          ayuda="Para calcular hasta cuándo puede reclamar si se denegó la información."
          valor={respuesta}
          onCambio={(v) => {
            setRespuesta(v);
            actualizarURL("respuesta", v);
          }}
        />
      </div>

      {avisos.map((a) => (
        <p key={a} className="estado estado-alerta" role="status">
          {a}
        </p>
      ))}

      <ol className="linea-tiempo">
        {hitos.map((h) => (
          <FilaHito key={h.id} hito={h} hoy={hoy} />
        ))}
      </ol>

      <p className="hitos-nota">
        El plazo de amparo del art. 24 dice &laquo;quince días&raquo;; se cuenta en días hábiles
        por tratarse de un procedimiento administrativo (art. 25, Ley 19.880).
      </p>
    </section>
  );
}
