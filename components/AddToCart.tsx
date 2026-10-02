"use client";
import { useCart } from "./CartProvider";

export function AddToCart({ id, name, price }: { id: number; name: string; price: number }) {
  const { add } = useCart();
  return (
    <button
      onClick={() => add({ id, name, price })}
      aria-label={`Agregar ${name} al carrito`}
      className="rounded-full border border-ink-muted px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background"
    >
      Agregar
    </button>
  );
}
