import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { friendsApi, usersApi } from "../api";
import type { FriendRequest, PublicUser } from "../types";
import { PageTransition } from "../components/PageTransition";
import { Avatar } from "../components/PostCard";
import { useAuth } from "../store";

export function Users() {
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [tab, setTab] = useState<"search" | "incoming" | "friends">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    if (!isAuth) return;
    setLoading(true);
    try {
      const [r, inc, fr] = await Promise.all([
        usersApi.search(q || undefined),
        friendsApi.incoming(),
        friendsApi.list(),
      ]);
      setResults(r);
      setIncoming(inc);
      setFriends(fr.map((f) => ({
        id: f.id, name: f.name, email: f.email || "",
        photo: f.photo, relation: "friend" as const,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (isAuth && tab === "search") usersApi.search(q || undefined).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab, isAuth]);

  if (!isAuth) {
    return (
      <PageTransition>
        <section className="max-w-md mx-auto pt-20 pb-20 text-center px-6">
          <h1 className="font-display font-extrabold text-3xl">Авторизация нужна</h1>
          <button onClick={() => nav("/login")} className="btn-primary mt-6">Войти</button>
        </section>
      </PageTransition>
    );
  }

  const act = async (action: "request" | "accept" | "reject" | "remove", id: string, label: string) => {
    try {
      if (action === "request") await friendsApi.request(id);
      else if (action === "accept") await friendsApi.accept(id);
      else if (action === "reject") await friendsApi.reject(id);
      else if (action === "remove") await friendsApi.remove(id);
      toast.success(label);
      loadAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <PageTransition>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Друзья</div>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">
          Найди своих
        </h1>

        <div className="mt-6 flex gap-1 border-b border-brand-100">
          <Tab active={tab === "search"} onClick={() => setTab("search")} label="Найти" />
          <Tab
            active={tab === "incoming"}
            onClick={() => setTab("incoming")}
            label="Заявки"
            count={incoming.length}
          />
          <Tab active={tab === "friends"} onClick={() => setTab("friends")} label={`Мои друзья (${friends.length})`} />
        </div>

        <div className="mt-6 space-y-3">
          {tab === "search" && (
            <>
              <div className="relative">
                <input
                  className="input pl-11"
                  placeholder="Имя или email..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              {results.length === 0 ? (
                <div className="card p-8 text-center text-ink/60">Никого не нашли</div>
              ) : (
                results.map((u, i) => (
                  <UserRow key={u.id} u={u} index={i} onAction={(a, l) => act(a, u.id, l)} />
                ))
              )}
            </>
          )}

          {tab === "incoming" && (
            <>
              {incoming.length === 0 ? (
                <div className="card p-8 text-center text-ink/60">Новых заявок нет</div>
              ) : (
                incoming.map((r, i) => (
                  <UserRow
                    key={r.user_id}
                    u={{ id: r.user_id, name: r.name, email: "", photo: r.photo, relation: "request_received" }}
                    index={i}
                    onAction={(a, l) => act(a, r.user_id, l)}
                  />
                ))
              )}
            </>
          )}

          {tab === "friends" && (
            <>
              {friends.length === 0 ? (
                <div className="card p-8 text-center text-ink/60">У вас пока нет друзей</div>
              ) : (
                friends.map((u, i) => (
                  <UserRow key={u.id} u={u} index={i} onAction={(a, l) => act(a, u.id, l)} />
                ))
              )}
            </>
          )}
        </div>
        {loading && <div className="text-center text-xs text-ink/40 mt-4">Обновление...</div>}
      </section>
    </PageTransition>
  );
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold transition ${
        active ? "text-brand-600" : "text-ink/50 hover:text-ink/80"
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-white text-[11px] font-bold">
          {count}
        </span>
      )}
      {active && (
        <motion.div
          layoutId="users-tab-underline"
          className="absolute left-2 right-2 bottom-0 h-0.5 bg-brand-500 rounded"
        />
      )}
    </button>
  );
}

function UserRow({
  u, index, onAction,
}: {
  u: PublicUser;
  index: number;
  onAction: (action: "request" | "accept" | "reject" | "remove", label: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="card p-4 flex items-center gap-3"
    >
      <Link to={`/users/${u.id}`} className="shrink-0">
        <Avatar name={u.name} photo={u.photo} size={48} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/users/${u.id}`} className="font-semibold hover:text-brand-600 block truncate">
          {u.name}
        </Link>
        {u.email && <div className="text-xs text-ink/50 truncate">{u.email}</div>}
      </div>
      <div className="flex gap-1.5">
        {u.relation === "stranger" && (
          <button onClick={() => onAction("request", "Заявка отправлена")} className="btn-soft !py-2 text-sm">
            Добавить
          </button>
        )}
        {u.relation === "request_sent" && (
          <span className="chip">Заявка отправлена</span>
        )}
        {u.relation === "request_received" && (
          <>
            <button onClick={() => onAction("accept", "Теперь вы друзья!")} className="btn-primary !py-2 text-sm">
              Принять
            </button>
            <button onClick={() => onAction("reject", "Заявка отклонена")} className="btn-ghost !py-2 text-sm">
              Отклонить
            </button>
          </>
        )}
        {u.relation === "friend" && (
          <>
            <Link to={`/messages/${u.id}`} className="btn-soft !py-2 text-sm">
              Написать
            </Link>
            <button
              onClick={() => {
                if (confirm("Удалить из друзей?")) onAction("remove", "Удалено из друзей");
              }}
              className="btn-ghost !py-2 !px-3 text-sm text-ink/60"
              title="Удалить из друзей"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
