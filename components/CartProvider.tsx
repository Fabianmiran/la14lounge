
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  qty: number;
};

type Ctx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (i: Omit<CartItem, "qty">) => void;
  setQty: (id: number, q: number) => void;
  clear: () => void;
};

const KEY = "la14_cart";
const CHANGE_EVENT = "la14_cart_changed";
const EMPTY = "[]";

const CartCtx = createContext<Ctx | null>(null);

// Validar los datos guardados en el navegador.
function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((r) =>
    Number.isInteger(r?.id) &&
    typeof r?.name === "string" &&
    Number.isInteger(r?.price) &&
    r.price >= 0 &&
    Number.isInteger(r?.qty) &&
    r.qty >= 1 &&
    r.qty <= 99
      ? [{
          id: r.id,
          name: r.name.slice(0, 120),
          price: r.price,
          qty: r.qty,
        }]
      : []
  );
}

// Respaldo en memoria si localStorage no está disponible.
let memoryCart = EMPTY;

function getSnapshot(): string {
  if (typeof window === "undefined") return EMPTY;

  try {
    return localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return memoryCart;
  }
}

function getServerSnapshot(): string {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function parseItems(raw: string): CartItem[] {
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveItems(items: CartItem[]): void {
  const value = JSON.stringify(items);
  memoryCart = value;

  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Conservar los datos en memoria.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const raw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const items = useMemo(() => parseItems(raw), [raw]);
  const [open, setOpen] = useState(false);

  const add = useCallback((i: Omit<CartItem, "qty">) => {
    const current = parseItems(getSnapshot());

    const next = current.some((x) => x.id === i.id)
      ? current.map((x) =>
          x.id === i.id
            ? { ...x, qty: Math.min(99, x.qty + 1) }
            : x
        )
      : [...current, { ...i, qty: 1 }];

    saveItems(next);
    setOpen(true);
  }, []);

  const setQty = useCallback((id: number, q: number) => {
    const current = parseItems(getSnapshot());

    const next =
      q <= 0
        ? current.filter((x) => x.id !== id)
        : current.map((x) =>
            x.id === id
              ? { ...x, qty: Math.min(99, q) }
              : x
          );

    saveItems(next);
  }, []);

  const clear = useCallback(() => {
    saveItems([]);
  }, []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce(
    (s, i) => s + i.qty * i.price,
    0
  );

  return (
    <CartCtx.Provider
      value={{
        items,
        count,
        subtotal,
        open,
        setOpen,
        add,
        setQty,
        clear,
      }}
    >
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);

  if (!c) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }

  return c;
}
