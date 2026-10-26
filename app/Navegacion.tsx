"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Calculadora" },
  { href: "/seguimiento", texto: "Seguimiento" },
];

export default function Navegacion() {
  const ruta = usePathname();
  return (
    <nav className="navegacion" aria-label="Secciones">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} aria-current={ruta === e.href ? "page" : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
