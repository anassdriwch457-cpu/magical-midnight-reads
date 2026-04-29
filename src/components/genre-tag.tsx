import { Link } from "@tanstack/react-router";

// Deterministic hue from genre name → consistent colorful pills
function hueFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function GenreTag({
  name,
  size = "sm",
  asLink = true,
}: {
  name: string;
  size?: "xs" | "sm" | "md";
  asLink?: boolean;
}) {
  const h = hueFor(name);
  const style = {
    background: `oklch(0.32 0.10 ${h} / 0.55)`,
    color: `oklch(0.92 0.08 ${h})`,
    borderColor: `oklch(0.55 0.14 ${h} / 0.5)`,
  };
  const sizeCls =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5"
      : size === "md"
      ? "text-xs px-2.5 py-1"
      : "text-[11px] px-2 py-0.5";
  const cls = `inline-flex items-center rounded-full border font-bold uppercase tracking-wider transition-colors hover:brightness-125 ${sizeCls}`;

  if (!asLink) {
    return <span className={cls} style={style}>{name}</span>;
  }
  return (
    <Link to="/browse" className={cls} style={style}>
      {name}
    </Link>
  );
}
