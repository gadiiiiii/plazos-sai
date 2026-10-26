import type { Metadata } from "next";
import Navegacion from "../Navegacion";
import Seguimiento from "./Seguimiento";
import { hoyEnChile } from "@/lib/plazos";
import { DIAS_PRONTO } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de SAI",
  description: "Lleva varias solicitudes de acceso a la información a la vez, ordenadas por urgencia.",
};

export default function Page() {
  return (
    <main className="ancho">
      <Navegacion />
      <header className="cabecera">
        <h1>Seguimiento de solicitudes</h1>
        <p>
          Agrega tus SAI en trámite y te las ordeno por urgencia: primero las vencidas, después
          las que vencen en {DIAS_PRONTO} días hábiles o menos.
        </p>
      </header>
      <Seguimiento hoy={hoyEnChile()} />
    </main>
  );
}
