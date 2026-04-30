import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SpringNumber, SPRING } from "@/lib/motion";

/** Premium shimmering-gold coin badge with spring-counted balance. */
export function CoinBadge({ coins }: { coins: number }) {
  const reduced = useReducedMotion();
  const prev = useRef(coins);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prev.current !== coins) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      prev.current = coins;
      return () => clearTimeout(t);
    }
  }, [coins]);

  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -1, scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={SPRING.snap}
      className="hidden sm:inline-flex"
    >
      <Link
        to="/topup"
        aria-label={`${coins} coins. Top up`}
        className="focus-ring group relative inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1
                   bg-gradient-to-b from-amber-300/15 to-amber-700/5
                   ring-1 ring-amber-300/40 hover:ring-amber-200/80
                   shadow-[0_0_18px_-6px_rgba(251,191,36,0.55)] hover:shadow-[0_0_24px_-4px_rgba(251,191,36,0.85)]"
      >
        <span
          className={`relative grid h-6 w-6 place-items-center rounded-full ring-1 ring-amber-100/60 overflow-hidden
                      shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(120,53,15,0.45)]
                      ${pulse && !reduced ? "animate-pulse-ring" : ""}`}
        >
          <span className="absolute inset-0 shimmer-gold" aria-hidden />
          <span className="relative text-[10px] font-black text-amber-950 leading-none drop-shadow-sm">¢</span>
        </span>
        <SpringNumber
          value={coins}
          className="text-sm font-extrabold tabular-nums shimmer-text"
        />
        <Plus className="h-3 w-3 text-amber-200/80 group-hover:text-amber-100 transition-colors" />
      </Link>
    </motion.div>
  );
}
