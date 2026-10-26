import { describe, expect, it } from "vitest";
import {
  aCSV,
  textoEstado,
  agregarSinDuplicados,
  contarPorGrupo,
  esListaValida,
  evaluar,
  ordenarPorUrgencia,
  parsearFecha,
  parsearPegado,
  type Solicitud,
} from "./seguimiento";

const HOY = "2026-10-26"; // lunes

function sai(folio: string, recepcion: string, extra: Partial<Solicitud> = {}): Solicitud {
  return { id: folio, folio, recepcion, prorrogada: false, ...extra };
}

// Vence 30-sep (18 y 19 de septiembre son feriados): vencida.
const vencida = sai("C-VENCIDA", "2026-09-01");
// Vence 27-oct: queda 1 día hábil.
const pronto = sai("B-PRONTO", "2026-09-28");
// Vence 3-nov: quedan 6 días hábiles.
const alDia = sai("A-AL-DIA", "2026-10-05");
// Respondida el 5-nov, después del vencimiento del 3-nov.
const respondida = sai("D-RESP", "2026-10-05", { respuesta: "2026-11-05" });

describe("evaluar", () => {
  it("clasifica según los días hábiles restantes", () => {
    expect(evaluar(vencida, HOY)).toMatchObject({ grupo: "vencida", vence: "2026-09-30" });
    expect(evaluar(pronto, HOY)).toMatchObject({ grupo: "pronto", vence: "2026-10-27", diasRestantes: 1 });
    expect(evaluar(alDia, HOY)).toMatchObject({ grupo: "al-dia", vence: "2026-11-03", diasRestantes: 6 });
  });

  it("usa el vencimiento con prórroga si se prorrogó", () => {
    const e = evaluar({ ...alDia, prorrogada: true }, HOY);
    expect(e.vence).toBe("2026-11-17");
    expect(e.diasRestantes).toBe(16);
  });

  it("una SAI vencida sigue vencida aunque se haya prorrogado", () => {
    const e = evaluar({ ...vencida, prorrogada: true }, HOY);
    expect(e.vence).toBe("2026-10-15");
    expect(e.grupo).toBe("vencida");
  });

  it("marca las respondidas, si fue fuera de plazo y hasta cuándo hay amparo", () => {
    expect(evaluar(respondida, HOY)).toEqual({
      grupo: "respondida",
      vence: "2026-11-03",
      diasRestantes: null,
      fueraDePlazo: true,
      amparoHasta: "2026-11-26",
      limiteSubsanacion: undefined,
    });
    const aTiempo = evaluar({ ...respondida, prorrogada: true, respuesta: "2026-11-10" }, HOY);
    expect(aTiempo.fueraDePlazo).toBe(false);
  });
});

describe("ordenarPorUrgencia y contarPorGrupo", () => {
  const lista = [respondida, alDia, pronto, vencida];

  it("ordena vencidas, vencen pronto, al día y respondidas", () => {
    const folios = ordenarPorUrgencia(lista, HOY).map((x) => x.solicitud.folio);
    expect(folios).toEqual(["C-VENCIDA", "B-PRONTO", "A-AL-DIA", "D-RESP"]);
  });

  it("dentro de un grupo, primero la que vence antes", () => {
    const otra = sai("E-AL-DIA", "2026-10-02"); // vence antes que A
    const folios = ordenarPorUrgencia([alDia, otra], HOY).map((x) => x.solicitud.folio);
    expect(folios).toEqual(["E-AL-DIA", "A-AL-DIA"]);
  });

  it("cuenta por grupo", () => {
    expect(contarPorGrupo(lista, HOY)).toEqual({ vencida: 1, pronto: 1, "al-dia": 1, subsanacion: 0, respondida: 1 });
  });
});

describe("parsearFecha", () => {
  it("acepta los formatos habituales", () => {
    expect(parsearFecha("2026-10-05")).toBe("2026-10-05");
    expect(parsearFecha("2026/10/5")).toBe("2026-10-05");
    expect(parsearFecha("05-10-2026")).toBe("2026-10-05");
    expect(parsearFecha("5/10/2026")).toBe("2026-10-05");
    expect(parsearFecha(" 05.10.26 ")).toBe("2026-10-05");
  });

  it("rechaza fechas inexistentes y texto", () => {
    expect(parsearFecha("31/02/2026")).toBeNull();
    expect(parsearFecha("MU046T0001234")).toBeNull();
    expect(parsearFecha("1234")).toBeNull();
    expect(parsearFecha("")).toBeNull();
  });
});

describe("parsearPegado", () => {
  it("lee filas de Excel con distintos separadores y omite el encabezado", () => {
    const texto = [
      "Folio\tFecha recepción",
      "MU001\t05-10-2026",
      "MU002;06/10/2026;30/10/2026",
      "",
      "MU003",
      "MU004,2026-10-01",
      "12/10/2026",
      "MU005\t10-10-2026\t01-10-2026",
    ].join("\r\n");

    const { filas, errores } = parsearPegado(texto);
    expect(filas).toEqual([
      { folio: "MU001", recepcion: "2026-10-05" },
      { folio: "MU002", recepcion: "2026-10-06", respuesta: "2026-10-30" },
      { folio: "MU004", recepcion: "2026-10-01" },
    ]);
    expect(errores).toEqual([
      "Línea 5: no encontré una fecha válida.",
      "Línea 7: falta el folio.",
      "Línea 8: la fecha de respuesta es anterior a la de recepción.",
    ]);
  });

  it("devuelve listas vacías si no hay nada", () => {
    expect(parsearPegado("  \n ")).toEqual({ filas: [], errores: [] });
  });
});

describe("agregarSinDuplicados", () => {
  it("salta folios repetidos sin distinguir mayúsculas", () => {
    const { lista, duplicados } = agregarSinDuplicados(
      [sai("MU001", "2026-10-05")],
      [sai("mu001", "2026-10-06"), sai("MU002", "2026-10-06"), sai("MU002 ", "2026-10-07")],
    );
    expect(lista.map((s) => s.folio)).toEqual(["MU001", "MU002"]);
    expect(duplicados).toEqual(["mu001", "MU002 "]);
  });
});

describe("esListaValida", () => {
  it("acepta datos bien formados y rechaza el resto", () => {
    expect(esListaValida([alDia, respondida])).toBe(true);
    expect(esListaValida([])).toBe(true);
    expect(esListaValida(null)).toBe(false);
    expect(esListaValida([{ ...alDia, recepcion: "05-10-2026" }])).toBe(false);
    expect(esListaValida([{ ...alDia, prorrogada: "no" }])).toBe(false);
  });
});

describe("aCSV", () => {
  it("genera un CSV para Excel en español, ordenado por urgencia", () => {
    const csv = aCSV([alDia, sai("MU;RARO", "2026-10-05", { prorrogada: true })], HOY);
    const lineas = csv.split("\r\n");
    expect(lineas[0]).toBe(
      "Folio;Recepción;Requerimiento de subsanación;Subsanación;Vence;Vence con prórroga;Prorrogada;Respuesta;Estado;Días hábiles restantes;Respondida fuera de plazo;Amparo hasta",
    );
    expect(lineas[1]).toBe("A-AL-DIA;05-10-2026;;;03-11-2026;17-11-2026;No;;Al día;6;;");
    expect(lineas[2]).toBe('"MU;RARO";05-10-2026;;;03-11-2026;17-11-2026;Sí;;Al día;16;;');
  });

  it("incluye respuesta, fuera de plazo y amparo para las respondidas", () => {
    const linea = aCSV([respondida], HOY).split("\r\n")[1];
    expect(linea).toBe("D-RESP;05-10-2026;;;03-11-2026;17-11-2026;No;05-11-2026;Respondida;;Sí;26-11-2026");
  });
});

describe("seguimiento con subsanación", () => {
  // Recepción 5-oct; requerimiento notificado el 6-oct: puede subsanar hasta el 14-oct.
  const esperando = sai("F-ESPERA", "2026-10-05", { requerimiento: "2026-10-06" });
  const subsanada = sai("G-SUBSANADA", "2026-10-05", { requerimiento: "2026-10-06", subsanacion: "2026-10-13" });

  it("mientras se espera la subsanación, el plazo no corre", () => {
    const e = evaluar(esperando, "2026-10-09");
    expect(e).toMatchObject({ grupo: "subsanacion", vence: null, diasRestantes: 2, desistida: false });
    expect(textoEstado(e)).toBe("En subsanación");
  });

  it("si pasó el plazo para subsanar, queda como desistida", () => {
    const e = evaluar(esperando, HOY);
    expect(e).toMatchObject({ grupo: "subsanacion", desistida: true, limiteSubsanacion: "2026-10-14" });
    expect(textoEstado(e)).toBe("Desistida");
  });

  it("una vez subsanada, vence 20 días hábiles después de la subsanación", () => {
    expect(evaluar(subsanada, HOY)).toMatchObject({ grupo: "al-dia", vence: "2026-11-10", diasRestantes: 11 });
  });

  it("las que esperan subsanación van después de las al día y antes de las respondidas", () => {
    const folios = ordenarPorUrgencia([respondida, esperando, alDia], HOY).map((x) => x.solicitud.folio);
    expect(folios).toEqual(["A-AL-DIA", "F-ESPERA", "D-RESP"]);
  });

  it("valida las fechas de subsanación guardadas", () => {
    expect(esListaValida([subsanada])).toBe(true);
    expect(esListaValida([{ ...subsanada, subsanacion: "13-10-2026" }])).toBe(false);
  });

  it("exporta las fechas de subsanación y deja el vencimiento vacío si el plazo no corre", () => {
    const csv = aCSV([esperando, subsanada], HOY).split("\r\n");
    expect(csv[1]).toBe("G-SUBSANADA;05-10-2026;06-10-2026;13-10-2026;10-11-2026;24-11-2026;No;;Al día;11;;");
    expect(csv[2]).toBe("F-ESPERA;05-10-2026;06-10-2026;;;;No;;Desistida;;;");
  });
});
