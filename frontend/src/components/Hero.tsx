import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { catalogApi } from "../api";
import type { ProductCard } from "../types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Hero() {
  const [picks, setPicks] = useState<ProductCard[]>([]);

  useEffect(() => {
    catalogApi.products({ limit: 60 }).then((p) => {
      const withImg = p.filter((x) => x.image);
      setPicks(shuffle(withImg).slice(0, 4));
    });
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-32 w-[28rem] h-[28rem] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute top-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-pink-200/40 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-100 text-xs font-semibold text-ink/70 mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Доставка по Москве сегодня · бесплатно от 2 990 ₽
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05 }}
            className="font-display font-extrabold tracking-tight text-[2.5rem] leading-[1.05] sm:text-[3.25rem] lg:text-[3.75rem]"
          >
            Зоомаркет<br />
            <span className="bg-gradient-to-r from-brand-600 to-rose-500 bg-clip-text text-transparent">
              для тех, кто рядом
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15 }}
            className="mt-5 text-lg text-ink/60 max-w-xl leading-relaxed"
          >
            Премиальные корма, аксессуары и здоровье — с экспертными статьями и персональными
            подборками под профиль вашей собаки.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/catalog" className="btn-primary text-base">
              В каталог
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/pets" className="btn-ghost text-base">
              Подобрать под питомца
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm"
          >
            <Stat n="10 000+" t="довольных хозяев" />
            <Stat n="48 ч" t="доставка по РФ" />
            <Stat n="4.8★" t="средний рейтинг" />
          </motion.div>
        </div>

        {/* Right side: product collage (4 random products, refreshes on reload) */}
        <div className="relative aspect-[6/7] lg:aspect-square">
          <Collage picks={picks} />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <div>
      <div className="text-2xl font-display font-extrabold text-ink">{n}</div>
      <div className="text-ink/55">{t}</div>
    </div>
  );
}

function Collage({ picks }: { picks: ProductCard[] }) {
  return (
    <div className="relative w-full h-full">
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="absolute left-[2%] top-[5%] w-[55%] aspect-square rounded-3xl shadow-soft overflow-hidden border-2 border-white"
      >
        <Tile p={picks[0]} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 3 }}
        animate={{ opacity: 1, y: 0, rotate: 3 }}
        transition={{ duration: 0.7, delay: 0.32 }}
        className="absolute right-[2%] top-[22%] w-[42%] aspect-square rounded-3xl shadow-soft overflow-hidden border-2 border-white"
      >
        <Tile p={picks[1]} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 5 }}
        animate={{ opacity: 1, y: 0, rotate: 5 }}
        transition={{ duration: 0.7, delay: 0.44 }}
        className="absolute left-[14%] bottom-[3%] w-[38%] aspect-square rounded-3xl shadow-soft overflow-hidden border-2 border-white"
      >
        <Tile p={picks[2]} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 0.7, delay: 0.56 }}
        className="absolute right-[8%] bottom-[8%] w-[45%] aspect-square rounded-3xl shadow-soft overflow-hidden border-2 border-white"
      >
        <Tile p={picks[3]} />
      </motion.div>
    </div>
  );
}

function Tile({ p }: { p?: ProductCard }) {
  if (!p) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-brand-100 to-pink-100 skeleton" />
    );
  }
  return (
    <div className="w-full h-full bg-white relative group">
      {p.image && (
        <img
          src={p.image}
          alt={p.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink/80 to-transparent">
        <div className="text-white text-xs font-semibold line-clamp-1">{p.title}</div>
        <div className="text-white/80 text-xs">{p.price.toLocaleString("ru-RU")} ₽</div>
      </div>
    </div>
  );
}
