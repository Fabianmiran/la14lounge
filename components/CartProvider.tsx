"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { id: number; name: string; price: number; qty: number };
type Ctx = {
  items: CartItem[]; count: number; subtotal: number;
  open: boolean; setOpen: (v: boolean) => void;
  add: (i: Omit<CartItem, "qty">) => void;
  setQty: (id: number, q: number) => void;
  clear: () => void;
};
const KEY = "la14_cart";
const CartCtx = createContext<Ctx | null>(null);

// Nunca se confía en lo guardado en el navegador: se valida cada campo.
function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) =>
    Number.isInteger(r?.id) && typeof r?.name === "string" &&
    Number.isInteger(r?.price) && r.price >= 0 &&
    Number.isInteger(r?.qty) && r.qty >= 1 && r.qty <= 99
      ? [{ id: r.id, name: r.name.slice(0, 120), price: r.price, qty: r.qty }]
      : []
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setItems(sanitize(JSON.parse(localStorage.getItem(KEY) ?? "[]"))); } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items, ready]);

  const add = useCallback((i: Omit<CartItem, "qty">) => {
    setItems((p) => p.some((x) => x.id === i.id)
      ? p.map((x) => (x.id === i.id ? { ...x, qty: Math.min(99, x.qty + 1) } : x))
      : [...p, { ...i, qty: 1 }]);
    setOpen(true);
  }, []);
  const setQty = useCallback((id: number, q: number) =>
    setItems((p) => (q <= 0 ? p.filter((x) => x.id !== id) : p.map((x) => (x.id === id ? { ...x, qty: Math.min(99, q) } : x)))), []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  return <CartCtx.Provider value={{ items, count, subtotal, open, setOpen, add, setQty, clear }}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart debe usarse dentro de CartProvider");
  return c;
}
