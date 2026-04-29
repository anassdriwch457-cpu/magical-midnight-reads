import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

/** Premium gold coin badge for header. */
export function CoinBadge({ coins }: { coins: number }) {
  return (
    <Link
      to="/topup"
      aria-label={`${coins} coins. Top up`}
      className="group relative hidden sm:flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1
                 bg-gradient-to-b from-amber-300/20 to-amber-700/10
                 ring-1 ring-amber-300/40 hover:ring-amber-200/70
                 shadow-[0_0_18px_-6px_rgba(251,191,36,0.6)] hover:shadow-[0_0_22px_-4px_rgba(251,191,36,0.8)]
                 transition-all"
    >
      <span
        className="relative grid h-6 w-6 place-items-center rounded-full
                   bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600
                   ring-1 ring-amber-100/70
                   shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(120,53,15,0.4)]"
      >
        <span className="text-[10px] font-black text-amber-900 leading-none drop-shadow-sm">¢</span>
      </span>
      <span className="text-sm font-extrabold tabular-nums text-amber-100 drop-shadow">
        {coins.toLocaleString()}
      </span>
      <Plus className="h-3 w-3 text-amber-200/80 group-hover:text-amber-100 transition-colors" />
    </Link>
  );
}
