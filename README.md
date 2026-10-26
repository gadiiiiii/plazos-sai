# Plazos SAI

Calculadora del plazo de respuesta de una **solicitud de acceso a la información pública** (SAI) en Chile, según la Ley 20.285.

Ingresas la fecha de recepción y obtienes:

- **Vencimiento**: 20 días hábiles (art. 14).
- **Vencimiento con prórroga**: 10 días hábiles adicionales.
- Cuántos días hábiles quedan desde hoy, o hace cuántos venció.
- Un calendario con los 30 días hábiles numerados, fines de semana y feriados marcados.
- Texto listo para copiar y un archivo `.ics` para agregar ambos vencimientos a tu calendario.

![Captura de la calculadora](docs/captura.png)

## Cómo se cuenta el plazo

- El conteo parte el **día siguiente** a la recepción (art. 25, Ley 19.880).
- Son inhábiles los **sábados, domingos y feriados nacionales**.
- Los feriados están en [`lib/feriados.ts`](lib/feriados.ts) para 2025, 2026 y 2027. Si el cálculo cae en un año no cargado, la app lo advierte.

**No considera**: feriados regionales ni suspensiones del plazo (por ejemplo, mientras se espera la subsanación del art. 12). Es una herramienta de apoyo; confirma siempre con tu procedimiento interno.

## API

```
GET /api/plazo?recepcion=2026-10-05
GET /api/plazo?recepcion=2026-10-05&hoy=2026-10-26
```

```json
{
  "recepcion": "2026-10-05",
  "vencimiento": "2026-11-03",
  "vencimientoProrroga": "2026-11-17",
  "diasRestantes": 6,
  "diasRestantesProrroga": 16,
  "feriadosEnRango": [{ "fecha": "2026-10-12", "motivo": "feriado", "nombre": "Encuentro de Dos Mundos" }],
  "fueraDeCobertura": false,
  "hoy": "2026-10-26"
}
```

Una fecha inválida devuelve `400` con un mensaje de error.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Vitest](https://vitest.dev) para los tests de la lógica de días hábiles
- Sin base de datos: todo el cálculo vive en [`lib/plazos.ts`](lib/plazos.ts)

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests de la lógica
npm run build    # build de producción
```

## Mantener los feriados al día

1. Abre `lib/feriados.ts`.
2. Agrega las fechas del año nuevo con su nombre.
3. Agrega el año a `AÑOS_CUBIERTOS`.
4. Corre `npm test`.

Revisa especialmente el Día Nacional de los Pueblos Indígenas (cambia según el solsticio), los feriados trasladables (29 de junio y 12 de octubre) y los feriados por elecciones.

## Licencia

MIT — Gadiel Vega Salgado
