export function Marquee({ text, reverse = false }: { text: string; reverse?: boolean }) {
  const half = Array.from({ length: 8 }, () => `${text}\u2003\u2003`).join("");
  return (
    <div className="overflow-hidden border-b border-rule" aria-hidden="true">
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>
        <span>{half}</span>
        <span>{half}</span>
      </div>
    </div>
  );
}
