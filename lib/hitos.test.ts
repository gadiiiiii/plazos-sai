import { describe, expect, it } from "vitest";
import { calcularHitos, type IdHito } from "./hitos";

function fechaDe(hitos: { id: IdHito; fecha: string }[], id: IdHito) {
  return hitos.find((h) => h.id === id)?.fecha;
}

describe("calcularHitos", () => {
  // Recepción: lunes 5 de octubre de 2026. Vence 3-nov; con prórroga, 17-nov.
  const recepcion = "2026-10-05";

  it("calcula los hitos que dependen solo de la recepción", () => {
    const { hitos, avisos } = calcularHitos(recepcion);
    expect(avisos).toEqual([]);
    expect(fechaDe(hitos, "comunicar-terceros")).toBe("2026-10-07");
    expect(fechaDe(hitos, "aviso-prorroga")).toBe("2026-11-03");
    expect(fechaDe(hitos, "amparo-sin-respuesta")).toBe("2026-11-24");
    // 8 de diciembre es feriado: el día 15 cae el 9.
    expect(fechaDe(hitos, "amparo-sin-respuesta-prorroga")).toBe("2026-12-09");
  });

  it("no incluye los hitos opcionales si no hay datos", () => {
    const ids = calcularHitos(recepcion).hitos.map((h) => h.id);
    expect(ids).not.toContain("notificacion-terceros");
    expect(ids).not.toContain("oposicion-terceros");
    expect(ids).not.toContain("amparo-respuesta");
  });

  it("calcula notificación y oposición del tercero desde la entrega en Correos", () => {
    const { hitos, avisos } = calcularHitos(recepcion, { entregaCorreosTercero: "2026-10-07" });
    expect(avisos).toEqual([]);
    // 8, 9 y (12 es feriado) 13 de octubre.
    expect(fechaDe(hitos, "notificacion-terceros")).toBe("2026-10-13");
    expect(fechaDe(hitos, "oposicion-terceros")).toBe("2026-10-16");
  });

  it("avisa si la carta al tercero salió fuera de plazo, pero igual calcula", () => {
    const { hitos, avisos } = calcularHitos(recepcion, { entregaCorreosTercero: "2026-10-09" });
    expect(avisos).toHaveLength(1);
    expect(fechaDe(hitos, "oposicion-terceros")).toBeDefined();
  });

  it("rechaza fechas opcionales anteriores a la recepción", () => {
    const { hitos, avisos } = calcularHitos(recepcion, {
      entregaCorreosTercero: "2026-10-01",
      notificacionRespuesta: "2026-10-01",
    });
    expect(avisos).toHaveLength(2);
    expect(fechaDe(hitos, "oposicion-terceros")).toBeUndefined();
    expect(fechaDe(hitos, "amparo-respuesta")).toBeUndefined();
  });

  it("calcula el amparo desde la notificación de la respuesta", () => {
    const { hitos } = calcularHitos(recepcion, { notificacionRespuesta: "2026-10-30" });
    expect(fechaDe(hitos, "amparo-respuesta")).toBe("2026-11-20");
  });

  it("ignora fechas opcionales mal formateadas", () => {
    const { hitos, avisos } = calcularHitos(recepcion, { notificacionRespuesta: "30-10-2026" });
    expect(avisos).toEqual([]);
    expect(fechaDe(hitos, "amparo-respuesta")).toBeUndefined();
  });

  it("entrega los hitos ordenados por fecha", () => {
    const { hitos } = calcularHitos(recepcion, {
      entregaCorreosTercero: "2026-10-07",
      notificacionRespuesta: "2026-10-30",
    });
    const fechas = hitos.map((h) => h.fecha);
    expect(fechas).toEqual([...fechas].sort());
    expect(hitos).toHaveLength(7);
  });
});
