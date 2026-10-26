import { describe, expect, it } from "vitest";
import {
  calcularPlazo,
  construirCalendario,
  diasHabilesEntre,
  esDiaHabil,
  esFechaValida,
  hoyEnChile,
  sumarDiasHabiles,
} from "./plazos";

describe("esFechaValida", () => {
  it("acepta fechas reales en formato AAAA-MM-DD", () => {
    expect(esFechaValida("2026-10-26")).toBe(true);
    expect(esFechaValida("2028-02-29")).toBe(true);
  });

  it("rechaza fechas inexistentes o mal formateadas", () => {
    expect(esFechaValida("2026-02-30")).toBe(false);
    expect(esFechaValida("26-10-2026")).toBe(false);
    expect(esFechaValida("2026-1-5")).toBe(false);
    expect(esFechaValida("")).toBe(false);
  });
});

describe("esDiaHabil", () => {
  it("excluye sábados, domingos y feriados", () => {
    expect(esDiaHabil("2026-10-24")).toBe(false); // sábado
    expect(esDiaHabil("2026-10-25")).toBe(false); // domingo
    expect(esDiaHabil("2026-10-12")).toBe(false); // Encuentro de Dos Mundos
    expect(esDiaHabil("2026-12-08")).toBe(false); // Inmaculada Concepción
  });

  it("acepta un lunes común", () => {
    expect(esDiaHabil("2026-10-26")).toBe(true);
  });
});

describe("sumarDiasHabiles", () => {
  it("cuenta desde el día siguiente a la recepción", () => {
    expect(sumarDiasHabiles("2026-10-26", 1)).toBe("2026-10-27");
  });

  it("salta fines de semana", () => {
    expect(sumarDiasHabiles("2026-10-23", 1)).toBe("2026-10-26"); // viernes → lunes
  });

  it("devuelve la misma fecha si n = 0", () => {
    expect(sumarDiasHabiles("2026-10-26", 0)).toBe("2026-10-26");
  });

  it("rechaza cantidades negativas o decimales", () => {
    expect(() => sumarDiasHabiles("2026-10-26", -1)).toThrow();
    expect(() => sumarDiasHabiles("2026-10-26", 1.5)).toThrow();
  });
});

describe("calcularPlazo", () => {
  it("calcula 20 + 10 días hábiles con un feriado en medio", () => {
    const r = calcularPlazo("2026-10-05");
    expect(r.vencimiento).toBe("2026-11-03");
    expect(r.vencimientoProrroga).toBe("2026-11-17");
    // 31-oct y 1-nov caen en fin de semana, así que no se listan: no corren el plazo.
    expect(r.feriadosEnRango.map((f) => f.fecha)).toEqual(["2026-10-12"]);
  });

  it("cruza el cambio de año con Navidad y Año Nuevo", () => {
    const r = calcularPlazo("2026-12-04");
    expect(r.vencimiento).toBe("2027-01-06");
  });

  it("funciona con una recepción en día inhábil", () => {
    expect(calcularPlazo("2026-10-10").vencimiento).toBe("2026-11-09");
  });

  it("marca cuando el cálculo sale de los años con feriados cargados", () => {
    expect(calcularPlazo("2026-10-05").fueraDeCobertura).toBe(false);
    expect(calcularPlazo("2027-12-20").fueraDeCobertura).toBe(true);
  });

  it("incluye días restantes cuando se entrega la fecha de hoy", () => {
    const r = calcularPlazo("2026-10-05", "2026-10-26");
    expect(r.diasRestantes).toBe(6);
    expect(r.diasRestantesProrroga).toBe(16);
  });

  it("deja días restantes en null si no se entrega hoy", () => {
    expect(calcularPlazo("2026-10-05").diasRestantes).toBeNull();
  });
});

describe("diasHabilesEntre", () => {
  it("es 0 si vence hoy", () => {
    expect(diasHabilesEntre("2026-11-03", "2026-11-03")).toBe(0);
  });

  it("cuenta días hábiles futuros", () => {
    expect(diasHabilesEntre("2026-10-26", "2026-11-03")).toBe(6);
    expect(diasHabilesEntre("2026-10-31", "2026-11-03")).toBe(2); // desde un sábado
  });

  it("es negativo si el plazo ya venció", () => {
    expect(diasHabilesEntre("2026-11-05", "2026-11-03")).toBe(-2);
  });
});

describe("construirCalendario", () => {
  it("numera 30 días hábiles y arma semanas completas desde el lunes", () => {
    const { vencimientoProrroga } = calcularPlazo("2026-10-05");
    const celdas = construirCalendario("2026-10-05", vencimientoProrroga);
    expect(celdas.length % 7).toBe(0);
    expect(celdas[0]?.fecha).toBe("2026-10-05"); // es lunes: sin relleno
    expect(celdas[0]?.esRecepcion).toBe(true);
    const habiles = celdas.filter((c) => c?.habil);
    expect(habiles).toHaveLength(30);
    expect(habiles[19]?.fecha).toBe("2026-11-03");
    expect(celdas.find((c) => c?.fecha === "2026-10-12")?.inhabil?.motivo).toBe("feriado");
  });
});

describe("hoyEnChile", () => {
  it("usa la zona horaria de Santiago", () => {
    // 02:00 UTC del 27 = 23:00 del 26 en Chile (UTC-3)
    expect(hoyEnChile(new Date("2026-10-27T02:00:00Z"))).toBe("2026-10-26");
  });
});
