"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { esFechaValida } from "@/lib/plazos";
import {
  aCSV,
  agregarSinDuplicados,
  contarPorGrupo,
  esListaValida,
  NOMBRE_GRUPO,
  ORDEN_GRUPOS,
  ordenarPorUrgencia,
  parsearPegado,
  textoEstado,
  type Evaluacion,
  type Grupo,
  type Solicitud,
} from "@/lib/seguimiento";

const CLAVE = "plazos-sai:seguimiento:v1";

function leer(): Solicitud[] {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return esListaValida(datos) ? datos : [];
  } catch {
    return [];
  }
}

function guardar(lista: Solicitud[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento disponible (modo privado, bloqueado): la lista vive solo en esta pestaña.
  }
}

function nuevoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatoFecha(fecha: string, hoy: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  const opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  if (fecha.slice(0, 4) !== hoy.slice(0, 4)) opciones.year = "numeric";
  return new Intl.DateTimeFormat("es-CL", opciones).format(new Date(Date.UTC(a, m - 1, d))).replaceAll(".", "");
}

function dias(n: number) {
  return `${n} ${n === 1 ? "día hábil" : "días hábiles"}`;
}

function detalleEstado(e: Evaluacion, hoy: string) {
  if (e.grupo === "respondida") return e.amparoHasta ? `Amparo hasta el ${formatoFecha(e.amparoHasta, hoy)}` : "";
  const n = e.diasRestantes ?? 0;
  if (e.grupo === "subsanacion") {
    if (e.desistida) return "No subsanó a tiempo";
    if (n === 0) return "Hoy es el último día para subsanar";
    return `Puede subsanar hasta el ${formatoFecha(e.limiteSubsanacion!, hoy)}`;
  }
  if (n < 0) return `Venció hace ${dias(-n)}`;
  if (n === 0) return "Vence hoy";
  return `${n === 1 ? "Falta" : "Faltan"} ${dias(n)}`;
}

interface Mensaje {
  tono: "ok" | "alerta";
  lineas: string[];
}

export default function Seguimiento({ hoy }: { hoy: string }) {
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [filtro, setFiltro] = useState<Grupo | "todas">("todas");
  const [folio, setFolio] = useState("");
  const [recepcion, setRecepcion] = useState(hoy);
  const [pegado, setPegado] = useState("");
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [eliminada, setEliminada] = useState<{ solicitud: Solicitud; indice: number } | null>(null);
  const campoFolio = useRef<HTMLInputElement>(null);

  useEffect(() => setLista(leer()), []);
  useEffect(() => {
    if (lista) guardar(lista);
  }, [lista]);

  const ordenadas = useMemo(() => (lista ? ordenarPorUrgencia(lista, hoy) : []), [lista, hoy]);
  const conteo = useMemo(() => contarPorGrupo(lista ?? [], hoy), [lista, hoy]);
  const visibles = filtro === "todas" ? ordenadas : ordenadas.filter((x) => x.evaluacion.grupo === filtro);

  function agregarUna(e: React.FormEvent) {
    e.preventDefault();
    if (!lista) return;
    const f = folio.trim();
    if (!f) return setMensaje({ tono: "alerta", lineas: ["Escribe el folio de la solicitud."] });
    if (!esFechaValida(recepcion)) return setMensaje({ tono: "alerta", lineas: ["Ingresa una fecha de recepción válida."] });

    const r = agregarSinDuplicados(lista, [{ id: nuevoId(), folio: f, recepcion, prorrogada: false }]);
    if (r.duplicados.length) {
      setMensaje({ tono: "alerta", lineas: [`Ya existe una solicitud con el folio ${f}.`] });
      return;
    }
    setLista(r.lista);
    setFolio("");
    setMensaje({ tono: "ok", lineas: [`Se agregó la solicitud ${f}.`] });
    setFiltro("todas");
    campoFolio.current?.focus();
  }

  function agregarPegadas() {
    if (!lista) return;
    const { filas, errores } = parsearPegado(pegado);
    const nuevas = filas.map((f) => ({ id: nuevoId(), prorrogada: false, ...f }));
    const r = agregarSinDuplicados(lista, nuevas);
    const agregadas = nuevas.length - r.duplicados.length;
    const lineas = [
      agregadas === 1 ? "Se agregó 1 solicitud." : `Se agregaron ${agregadas} solicitudes.`,
      ...(r.duplicados.length ? [`Se omitieron folios que ya estaban: ${r.duplicados.join(", ")}.`] : []),
      ...errores,
    ];
    setLista(r.lista);
    setMensaje({ tono: errores.length || r.duplicados.length || agregadas === 0 ? "alerta" : "ok", lineas });
    if (!errores.length) setPegado("");
    setFiltro("todas");
  }

  function actualizar(id: string, cambio: Partial<Solicitud>) {
    setLista((l) =>
      l?.map((s) => {
        if (s.id !== id) return s;
        const nueva = { ...s, ...cambio };
        if (!nueva.requerimiento) delete nueva.subsanacion;
        for (const clave of ["respuesta", "requerimiento", "subsanacion"] as const) {
          if (!nueva[clave]) delete nueva[clave];
        }
        return nueva;
      }) ?? null,
    );
  }

  /** Acepta la fecha solo si es válida y no es anterior a `desde`. */
  function fechaDesde(valor: string, desde: string) {
    return esFechaValida(valor) && valor >= desde ? valor : undefined;
  }

  function eliminar(id: string) {
    if (!lista) return;
    const indice = lista.findIndex((s) => s.id === id);
    setEliminada({ solicitud: lista[indice], indice });
    setLista(lista.filter((s) => s.id !== id));
    setMensaje(null);
  }

  function deshacer() {
    if (!eliminada || !lista) return;
    const copia = [...lista];
    copia.splice(eliminada.indice, 0, eliminada.solicitud);
    setLista(copia);
    setEliminada(null);
  }

  function exportar() {
    if (!lista?.length) return;
    const blob = new Blob(["﻿" + aCSV(lista, hoy)], { type: "text/csv;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `seguimiento-sai-${hoy}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  function borrarTodo() {
    if (!lista?.length) return;
    if (!window.confirm(`¿Borrar las ${lista.length} solicitudes de este navegador? No se puede deshacer.`)) return;
    setLista([]);
    setEliminada(null);
    setMensaje(null);
  }

  return (
    <>
      <p className="aviso-privacidad">
        La lista se guarda solo en este navegador y no se envía a ningún servidor. Basta con el
        folio: no ingreses nombres ni datos personales. Exporta a CSV para respaldarla.
      </p>

      <section className="agregar" aria-labelledby="titulo-agregar">
        <h2 id="titulo-agregar">Agregar solicitudes</h2>
        <form className="fila-agregar" onSubmit={agregarUna}>
          <div>
            <label htmlFor="folio">Folio</label>
            <input
              id="folio"
              ref={campoFolio}
              type="text"
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="MU046T0001234"
            />
          </div>
          <div>
            <label htmlFor="fecha-recepcion">Recepción</label>
            <input id="fecha-recepcion" type="date" value={recepcion} onChange={(e) => setRecepcion(e.target.value)} />
          </div>
          <button type="submit" className="primario">
            Agregar
          </button>
        </form>

        <details className="pegar">
          <summary>Pegar varias desde Excel</summary>
          <label htmlFor="pegado">
            Copia las columnas desde tu planilla: folio y fecha de recepción, y si quieres una
            tercera con la fecha de respuesta. Una solicitud por línea.
          </label>
          <textarea
            id="pegado"
            rows={6}
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            placeholder={"MU046T0001234\t05-10-2026\nMU046T0001240\t07-10-2026\t28-10-2026"}
            spellCheck={false}
          />
          <button type="button" onClick={agregarPegadas} disabled={!pegado.trim()}>
            Agregar todas
          </button>
        </details>

        {mensaje && (
          <div className={`estado estado-${mensaje.tono}`} role="status">
            {mensaje.lineas.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        )}
      </section>

      <section className="bandeja" aria-labelledby="titulo-bandeja">
        <div className="bandeja-cabecera">
          <h2 id="titulo-bandeja">Solicitudes</h2>
          <div className="acciones">
            <button type="button" onClick={exportar} disabled={!lista?.length}>
              Exportar CSV
            </button>
            <button type="button" className="peligro" onClick={borrarTodo} disabled={!lista?.length}>
              Borrar todo
            </button>
          </div>
        </div>

        {eliminada && (
          <p className="estado estado-alerta deshacer" role="status">
            Se eliminó la solicitud {eliminada.solicitud.folio}.
            <button type="button" className="enlace" onClick={deshacer}>
              Deshacer
            </button>
          </p>
        )}

        {lista === null ? (
          <p className="vacio-texto">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="vacio-texto">
            Todavía no hay solicitudes. Agrega la primera con su folio y fecha de recepción, o pega
            varias desde tu planilla.
          </p>
        ) : (
          <>
            <div className="filtros" role="group" aria-label="Filtrar por estado">
              <button type="button" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>
                <span className="filtro-numero">{lista.length}</span> Todas
              </button>
              {ORDEN_GRUPOS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`filtro-${g}`}
                  aria-pressed={filtro === g}
                  onClick={() => setFiltro(g)}
                  disabled={conteo[g] === 0 && filtro !== g}
                >
                  <span className="filtro-numero">{conteo[g]}</span> {NOMBRE_GRUPO[g]}
                </button>
              ))}
            </div>

            {visibles.length === 0 ? (
              <p className="vacio-texto">No hay solicitudes en este estado.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla-sai">
                  <thead>
                    <tr>
                      <th scope="col">Folio</th>
                      <th scope="col">Recepción</th>
                      <th scope="col">Subsanación</th>
                      <th scope="col">Vence</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Prórroga</th>
                      <th scope="col">Respuesta</th>
                      <th scope="col">
                        <span className="solo-lector">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(({ solicitud: s, evaluacion: e }) => {
                      const params = new URLSearchParams({ recepcion: s.recepcion });
                      if (s.respuesta) params.set("respuesta", s.respuesta);
                      if (s.requerimiento) params.set("requerimiento", s.requerimiento);
                      if (s.subsanacion) params.set("subsanacion", s.subsanacion);
                      const resumenSubsanacion = s.subsanacion
                        ? `Subsanó el ${formatoFecha(s.subsanacion, hoy)}`
                        : s.requerimiento
                          ? `Pedida el ${formatoFecha(s.requerimiento, hoy)}`
                          : "No";
                      return (
                        <tr key={s.id} className={`fila-${e.grupo}`}>
                          <th scope="row" className="celda-folio">
                            {s.folio}
                          </th>
                          <td data-etiqueta="Recepción">{formatoFecha(s.recepcion, hoy)}</td>
                          <td data-etiqueta="Subsanación">
                            <details className="celda-subsanacion">
                              <summary aria-label={`Subsanación de ${s.folio}: ${resumenSubsanacion}`}>
                                {resumenSubsanacion}
                              </summary>
                              <label>
                                <span>Requerimiento notificado</span>
                                <input
                                  type="date"
                                  className="fecha-celda"
                                  value={s.requerimiento ?? ""}
                                  min={s.recepcion}
                                  onChange={(ev) =>
                                    actualizar(s.id, { requerimiento: fechaDesde(ev.target.value, s.recepcion) })
                                  }
                                />
                              </label>
                              <label>
                                <span>Subsanó el</span>
                                <input
                                  type="date"
                                  className="fecha-celda"
                                  value={s.subsanacion ?? ""}
                                  min={s.requerimiento}
                                  disabled={!s.requerimiento}
                                  onChange={(ev) =>
                                    actualizar(s.id, {
                                      subsanacion: s.requerimiento
                                        ? fechaDesde(ev.target.value, s.requerimiento)
                                        : undefined,
                                    })
                                  }
                                />
                              </label>
                            </details>
                          </td>
                          <td data-etiqueta="Vence">
                            {e.vence ? (
                              <>
                                {formatoFecha(e.vence, hoy)}
                                {s.prorrogada && <span className="nota-celda">con prórroga</span>}
                                {s.subsanacion && <span className="nota-celda">desde la subsanación</span>}
                              </>
                            ) : (
                              <span className="nota-celda sin-plazo">Aún no corre</span>
                            )}
                          </td>
                          <td data-etiqueta="Estado">
                            <span className={`pastilla pastilla-${e.desistida ? "respondida" : e.grupo}`}>
                              {textoEstado(e)}
                            </span>
                            {e.fueraDePlazo && <span className="pastilla pastilla-vencida">Fuera de plazo</span>}
                            <span className="nota-celda">{detalleEstado(e, hoy)}</span>
                          </td>
                          <td data-etiqueta="Prórroga">
                            <label className="casilla">
                              <input
                                type="checkbox"
                                checked={s.prorrogada}
                                onChange={(ev) => actualizar(s.id, { prorrogada: ev.target.checked })}
                              />
                              <span>{s.prorrogada ? "Prorrogada" : "No"}</span>
                            </label>
                          </td>
                          <td data-etiqueta="Respuesta">
                            <input
                              type="date"
                              className="fecha-celda"
                              value={s.respuesta ?? ""}
                              min={s.recepcion}
                              aria-label={`Fecha de respuesta de ${s.folio}`}
                              onChange={(ev) =>
                                actualizar(s.id, {
                                  respuesta:
                                    esFechaValida(ev.target.value) && ev.target.value >= s.recepcion
                                      ? ev.target.value
                                      : undefined,
                                })
                              }
                            />
                          </td>
                          <td className="celda-acciones">
                            <Link href={`/?${params}`}>Ver hitos</Link>
                            <button
                              type="button"
                              className="enlace peligro"
                              onClick={() => eliminar(s.id)}
                              aria-label={`Eliminar ${s.folio}`}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
