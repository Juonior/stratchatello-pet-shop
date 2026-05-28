import { motion } from "framer-motion";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      whileHover={{ rotate: -6, scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#lg-g)" />
      {/* Stylized paw */}
      <g fill="#fff">
        <circle cx="16" cy="20" r="3.2" />
        <circle cx="24" cy="16" r="3.5" />
        <circle cx="32" cy="20" r="3.2" />
        <path d="M14 32c0-5 4.5-8 10-8s10 3 10 8c0 3.5-3 5.5-6 5.5-1.8 0-2.4-.7-4-.7s-2.2.7-4 .7c-3 0-6-2-6-5.5z" />
      </g>
    </motion.svg>
  );
}

export function LogoFull({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display font-extrabold text-xl tracking-tight">
        <span className="text-ink">Хвост</span>
        <span className="bg-gradient-to-r from-brand-600 to-rose-500 bg-clip-text text-transparent">айл</span>
      </span>
    </div>
  );
}
