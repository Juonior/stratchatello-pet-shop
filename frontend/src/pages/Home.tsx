import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Hero } from "../components/Hero";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";
import { PageTransition } from "../components/PageTransition";
import { catalogApi, recsApi } from "../api";
import type { Category, RecommendationBlock } from "../types";

export function Home() {
  const [cats, setCats] = useState<Category[]>([]);
  const [recs, setRecs] = useState<RecommendationBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([catalogApi.categories(), recsApi.get()])
      .then(([c, r]) => {
        setCats(c);
        setRecs(r);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <Hero />

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <SectionTitle eyebrow="Категории" title="Каталог по разделам" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {cats.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              whileHover={{ y: -6 }}
            >
              <Link
                to={`/catalog/${c.slug}`}
                className="group relative block aspect-[4/5] rounded-2xl overflow-hidden border border-brand-100/80 shadow-sm hover:shadow-soft transition-all"
              >
                {c.cover_image ? (
                  <img
                    src={c.cover_image}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-100 to-pink-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <div className="absolute left-3 right-3 bottom-3 text-white">
                  <div className="font-display font-bold text-base sm:text-lg leading-tight">{c.title}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Recommendation blocks */}
      {loading && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-14">
          <ProductGridSkeleton />
        </section>
      )}

      {recs.map((block, idx) => (
        <section key={idx} className="max-w-7xl mx-auto px-4 sm:px-6 mt-14">
          <SectionTitle
            eyebrow={idx === 0 && block.title.startsWith("Подборка") ? "Персонально" : "Подборка"}
            title={block.title}
            subtitle={block.reason}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {block.products.map((p, i) => (
              <ProductCard p={p} key={p.id} index={i} />
            ))}
          </div>
        </section>
      ))}

      {/* Trust block */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-20">
        <div className="card p-8 md:p-12 bg-gradient-to-br from-brand-50 via-cream to-pink-50 border-brand-200">
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            <Feature
              title="Быстрая доставка"
              text="По Москве за 2 часа, по России за 1–3 дня"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 3h13v13H1zM14 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                </svg>
              }
            />
            <Feature
              title="Качество гарантировано"
              text="Только сертифицированные товары от проверенных брендов"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              }
            />
            <Feature
              title="Экспертные статьи"
              text="Советы ветеринаров, кинологов и зоопсихологов"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
                  <path d="M4 17a3 3 0 0 1 3-3h12" />
                </svg>
              }
            />
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-6"
    >
      <div className="text-xs font-bold uppercase tracking-widest text-brand-600">{eyebrow}</div>
      <h2 className="font-display font-extrabold text-2xl sm:text-3xl mt-1">{title}</h2>
      {subtitle && <p className="text-ink/60 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <div className="w-12 h-12 rounded-xl bg-white border border-brand-200/80 flex items-center justify-center text-brand-600 shrink-0">
        <div className="w-6 h-6">{icon}</div>
      </div>
      <div>
        <div className="font-display font-bold text-lg">{title}</div>
        <div className="text-ink/60 mt-1">{text}</div>
      </div>
    </div>
  );
}
