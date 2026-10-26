import { describe, expect, it } from "vitest";
import { analizarSubsanacion, esperaSubsanacion } from "./subsanacion";
import { calcularPlazo } from "./plazos";

const RECEPCION = "2026-10-05"; // lunes

describe("analizarSubsanacion", () => {
  it("sin requerimiento, el plazo corre desde la recepción", () => {
    expect(analizarSubsanacion(RECEPCION)).toEqual({
      subsanacion: { tipo: "no-aplica", inicio: RECEPCION },
      avisos: [],
    });
  });

  it("con requerimiento y sin subsanación, el plazo no corre", () => {
    // Requerimiento notificado el martes 6-oct: 7, 8, 9, (12 feriado) 13, 14.
    const { subsanacion, avisos } = analizarSubsanacion(RECEPCION, { requerimiento: "2026-10-06" });
    expect(subsanacion).toEqual({ tipo: "esperando", requerimiento: "2026-10-06", limite: "2026-10-14", inicio: null });
    expect(avisos).toEqual([]);
  });

  it("si subsana a tiempo, el art. 14 corre desde la subsanación", () => {
    const { subsanacion, avisos } = analizarSubsanacion(RECEPCION, {
      requerimiento: "2026-10-06",
      subsanacion: "2026-10-13",
    });
    expect(avisos).toEqual([]);
    expect(subsanacion).toMatchObject({ tipo: "subsanada", inicio: "2026-10-13", fueraDePlazo: false });
    // 20 días hábiles desde el 13-oct: 14-oct ... 10-nov.
    expect(calcularPlazo(subsanacion.inicio!).vencimiento).toBe("2026-11-10");
  });

  it("subsanar el último día del plazo sigue siendo a tiempo", () => {
    const { subsanacion } = analizarSubsanacion(RECEPCION, { requerimiento: "2026-10-06", subsanacion: "2026-10-14" });
    expect(subsanacion).toMatchObject({ tipo: "subsanada", fueraDePlazo: false });
  });

  it("avisa si subsanó fuera de plazo, pero igual calcula desde la subsanación", () => {
    const { subsanacion, avisos } = analizarSubsanacion(RECEPCION, {
      requerimiento: "2026-10-06",
      subsanacion: "2026-10-15",
    });
    expect(subsanacion).toMatchObject({ tipo: "subsanada", inicio: "2026-10-15", fueraDePlazo: true });
    expect(avisos).toHaveLength(1);
  });

  it("rechaza fechas fuera de orden", () => {
    const antes = analizarSubsanacion(RECEPCION, { requerimiento: "2026-10-01" });
    expect(antes.subsanacion.tipo).toBe("no-aplica");
    expect(antes.avisos).toHaveLength(1);

    const subsanaAntes = analizarSubsanacion(RECEPCION, { requerimiento: "2026-10-06", subsanacion: "2026-10-05" });
    expect(subsanaAntes.subsanacion.tipo).toBe("esperando");
    expect(subsanaAntes.avisos).toHaveLength(1);
  });

  it("pide el requerimiento si solo viene la subsanación", () => {
    const { subsanacion, avisos } = analizarSubsanacion(RECEPCION, { subsanacion: "2026-10-13" });
    expect(subsanacion.tipo).toBe("no-aplica");
    expect(avisos).toHaveLength(1);
  });

  it("ignora fechas mal formateadas", () => {
    expect(analizarSubsanacion(RECEPCION, { requerimiento: "06-10-2026" })).toEqual({
      subsanacion: { tipo: "no-aplica", inicio: RECEPCION },
      avisos: [],
    });
  });
});

describe("esperaSubsanacion", () => {
  it("cuenta los días que le quedan al solicitante", () => {
    expect(esperaSubsanacion("2026-10-14", "2026-10-09")).toEqual({ diasRestantes: 2, desistida: false });
    expect(esperaSubsanacion("2026-10-14", "2026-10-14")).toEqual({ diasRestantes: 0, desistida: false });
  });

  it("marca como desistida si pasó el plazo", () => {
    expect(esperaSubsanacion("2026-10-14", "2026-10-15")).toEqual({ diasRestantes: -1, desistida: true });
  });
});
