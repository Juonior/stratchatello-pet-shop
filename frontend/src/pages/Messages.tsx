import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { messagesApi } from "../api";
import type { Thread } from "../types";
import { PageTransition } from "../components/PageTransition";
import { Avatar } from "../components/PostCard";
import { useAuth } from "../store";

export function Messages() {
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth) return;
    messagesApi.threads().then((t) => setThreads(t)).finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) {
    return (
      <PageTransition>
        <section className="max-w-md mx-auto pt-20 text-center px-6">
          <h1 className="font-display font-extrabold text-3xl">Авторизация нужна</h1>
          <button onClick={() => nav("/login")} className="btn-primary mt-6">Войти</button>
        </section>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Сообщения</div>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1 mb-6">Личные чаты</h1>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-20 skeleton" />)}
          </div>
        ) : threads.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="font-display font-extrabold text-xl">Переписок пока нет</div>
            <p className="text-ink/60 mt-1">Найдите друзей и напишите им первое сообщение.</p>
            <button onClick={() => nav("/users")} className="btn-primary mt-5">Найти друзей</button>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((t, i) => (
              <motion.div
                key={t.peer_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/messages/${t.peer_id}`}
                  className="card p-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-soft transition-all"
                >
                  <Avatar name={t.peer_name} photo={t.peer_photo} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold truncate">{t.peer_name}</div>
                      {t.last_message_at && (
                        <div className="text-xs text-ink/40 shrink-0">
                          {new Date(t.last_message_at).toLocaleString("ru-RU", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                    {t.last_message_text && (
                      <div className="text-sm text-ink/60 truncate">
                        {t.last_from_me && <span className="text-ink/40">Вы: </span>}
                        {t.last_message_text}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </PageTransition>
  );
}
