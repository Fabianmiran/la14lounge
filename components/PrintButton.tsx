// [LA14 · COTIZADOR · v1] components/PrintButton.tsx
"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-ink-muted px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-background"
    >
      Imprimir / guardar PDF
    </button>
  );
}
