import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { articlesApi } from "../api";
import type { ArticleCard } from "../types";
import { PageTransition } from "../components/PageTransition";

export function Articles() {
  const [items, setItems] = useState<ArticleCard[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesApi.topics().then(setTopics);
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      articlesApi.list(q || undefined, topic).then((d) => {
        setItems(d);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, topic]);

  return (
    <PageTransition>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Журнал</div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">
            Экспертные статьи о собаках
          </h1>
          <p className="text-ink/60 mt-2">
            Питание, дрессировка, здоровье и поведение — от ветеринаров и кинологов.
          </p>
        </motion.div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <input
              className="input pl-11"
              placeholder="Поиск по статьям..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-2 px-2">
            <Chip active={!topic} onClick={() => setTopic(undefined)}>Все темы</Chip>
            {topics.map((t) => (
              <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>{t}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="aspect-[16/10] skeleton" />
                  <div className="p-5 space-y-2">
                    <div className="skeleton h-3 w-1/4" />
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                </div>
              ))
            : items.length === 0
              ? <div className="md:col-span-3 card p-10 text-center text-ink/60">Статей не нашлось.</div>
              : items.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -6 }}
                >
                  <Link to={`/articles/${a.id}`} className="card overflow-hidden block h-full hover:shadow-soft hover:border-brand-200 transition-all">
                    <div className="aspect-[16/10] overflow-hidden">
                      {a.image && <img src={a.image} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />}
                    </div>
                    <div className="p-5">
                      <div className="chip">{a.topic}</div>
                      <h3 className="font-display font-bold text-lg mt-3 leading-snug">{a.title}</h3>
                      <p className="text-ink/60 mt-2 text-sm line-clamp-2">{a.annotation}</p>
                      <div className="mt-4 flex items-center justify-between text-xs text-ink/50">
                        <span>{a.author}</span>
                        <span>{new Date(a.published_at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>
      </section>
    </PageTransition>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold transition ${
        active ? "bg-brand-500 text-white shadow-soft" : "bg-white border border-brand-200 text-ink/70 hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );
}
