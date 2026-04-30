import { useEffect, useState } from "react";

type Particle = { id: number; tx: number; ty: number; size: number; hue: number; delay: number };

/**
 * Premium sparkle/confetti micro-animation.
 * Mount this component when a celebratory event happens (chapter unlocked, top-up).
 * It auto-unmounts after the animation finishes.
 */
export function SparkleBurst({
  count = 22,
  duration = 1200,
  onDone,
}: {
  count?: number;
  duration?: number;
  onDone?: () => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const list: Particle[] = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 70 + Math.random() * 110;
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 20, // bias upward
        size: 5 + Math.random() * 7,
        hue: [50, 305, 340, 88][Math.floor(Math.random() * 4)],
        delay: Math.random() * 120,
      };
    });
    setParticles(list);
    const t = setTimeout(() => onDone?.(), duration + 200);
    return () => clearTimeout(t);
  }, [count, duration, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center" aria-hidden>
      <div className="relative h-0 w-0">
        {/* Core flash */}
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full blur-2xl animate-sparkle"
          style={{
            background:
              "radial-gradient(circle, oklch(0.86 0.16 88 / 0.95) 0%, oklch(0.74 0.18 50 / 0.6) 40%, transparent 70%)",
            // @ts-expect-error custom prop
            "--tx": "0px",
            "--ty": "0px",
            animationDuration: "900ms",
          }}
        />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-sparkle"
            style={{
              width: p.size,
              height: p.size,
              background: `oklch(0.85 0.18 ${p.hue})`,
              boxShadow: `0 0 12px oklch(0.85 0.18 ${p.hue} / 0.85)`,
              // @ts-expect-error custom prop
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${duration}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
