"use client";

// [LA14 · TEMA · v1] components/ThemeToggle.tsx
// Botón claro/oscuro. Guarda la elección en este navegador (localStorage).
// El texto del botón cambia con CSS, así no hay parpadeo ni estado que sincronizar.

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("la14-tema", next);
    } catch {
      /* navegador sin almacenamiento: el cambio vale solo para esta visita */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      className={`font-mono text-xs uppercase tracking-[0.18em] text-ink-muted hover:text-ink ${className}`}
    >
      <span className="tema-a-claro">☀ Claro</span>
      <span className="tema-a-oscuro">☾ Oscuro</span>
    </button>
  );
}
