import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { articlesApi } from "../api";
import type { Article } from "../types";
import { PageTransition } from "../components/PageTransition";

export function ArticlePage() {
  const { id } = useParams();
  const [a, setA] = useState<Article | null>(null);

  useEffect(() => {
    if (id) articlesApi.get(id).then(setA);
  }, [id]);

  if (!a) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto px-4 pt-10 space-y-4">
          <div className="skeleton h-4 w-1/4" />
          <div className="skeleton h-10 w-3/4" />
          <div className="skeleton aspect-[16/9] w-full" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <Link to="/articles" className="text-sm text-brand-600 hover:underline">← ко всем статьям</Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <span className="chip">{a.topic}</span>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl mt-3 leading-tight">
            {a.title}
          </h1>
          <div className="mt-3 text-ink/50 text-sm">
            {a.author} · {new Date(a.published_at).toLocaleDateString("ru-RU")}
          </div>
        </motion.div>

        {a.image && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 rounded-3xl overflow-hidden aspect-[16/9] bg-brand-50"
          >
            <img src={a.image} alt={a.title} className="w-full h-full object-cover" />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="prose max-w-none mt-8 text-lg leading-relaxed text-ink/80"
        >
          <p className="text-xl text-ink/90 font-medium">{a.annotation}</p>
          <div className="mt-6 whitespace-pre-line">{a.body}</div>
        </motion.div>
      </article>
    </PageTransition>
  );
}
