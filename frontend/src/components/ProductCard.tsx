import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import type { ProductCard as P } from "../types";
import { useAuth, useCart } from "../store";
import { useNavigate } from "react-router-dom";

export function ProductCard({ p, index = 0 }: { p: P; index?: number }) {
  const add = useCart((s) => s.add);
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();

  const onAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuth) {
      toast("Войдите, чтобы добавить в корзину", { icon: "🔒" });
      nav("/login");
      return;
    }
    try {
      await add(p.id, 1);
      toast.success(`«${p.title}» в корзине`);
    } catch {
      toast.error("Не удалось добавить");
    }
  };

  const discount =
    p.old_price && p.old_price > p.price
      ? Math.round((1 - p.price / p.old_price) * 100)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group"
    >
      <Link
        to={`/product/${p.id}`}
        className="card overflow-hidden block h-full flex flex-col hover:shadow-soft hover:border-brand-200 transition-all duration-300"
      >
        <div className="relative aspect-square overflow-hidden bg-cream">
          {p.image ? (
            <img
              src={p.image}
              alt={p.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-50 to-pink-50" />
          )}
          {discount && (
            <div className="absolute top-3 left-3 bg-brand-500 text-white text-xs font-bold rounded-full px-2.5 py-1 shadow-soft">
              −{discount}%
            </div>
          )}
          {!p.in_stock && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center font-bold">
              Нет в наличии
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1">
          {p.brand && <div className="text-xs text-ink/50 uppercase font-semibold">{p.brand}</div>}
          <div className="font-semibold leading-snug line-clamp-2 min-h-[2.5em]">{p.title}</div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-yellow-500">★</span>
            <span className="font-semibold">{p.rating.toFixed(1)}</span>
            <span className="text-ink/40">({p.rating_count})</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="flex flex-col">
              {p.old_price && p.old_price > p.price && (
                <span className="text-xs text-ink/40 line-through">{p.old_price.toLocaleString("ru-RU")} ₽</span>
              )}
              <span className="font-display font-bold text-lg text-ink">
                {p.price.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.93 }}
              onClick={onAdd}
              className="btn-primary !p-2.5 !rounded-xl"
              aria-label="В корзину"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.7 5h13.4M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
              </svg>
            </motion.button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
