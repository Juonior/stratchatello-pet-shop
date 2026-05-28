import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { chatsApi, friendsApi, messagesApi } from "../api";
import type { ChatThread, Friend, Thread } from "../types";
import { PageTransition } from "../components/PageTransition";
import { Avatar } from "../components/PostCard";
import { useAuth } from "../store";

type Item =
  | { kind: "dm"; t: Thread; at: number }
  | { kind: "group"; t: ChatThread; at: number };

export function Messages() {
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [dms, setDms] = useState<Thread[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    if (!isAuth) return;
    setLoading(true);
    try {
      const [d, c] = await Promise.all([messagesApi.threads(), chatsApi.list()]);
      setDms(d);
      setChats(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const items: Item[] = [
    ...dms.map<Item>((t) => ({
      kind: "dm",
      t,
      at: t.last_message_at ? new Date(t.last_message_at).getTime() : 0,
    })),
    ...chats.map<Item>((t) => ({
      kind: "group",
      t,
      at: t.last_message_at ? new Date(t.last_message_at).getTime() : 0,
    })),
  ];
  items.sort((a, b) => b.at - a.at);

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Сообщения</div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">Все чаты</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + Новая беседа
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-20 skeleton" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="font-display font-extrabold text-xl">Переписок пока нет</div>
            <p className="text-ink/60 mt-1">Напишите другу или создайте групповую беседу.</p>
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={() => nav("/users")} className="btn-ghost">К друзьям</button>
              <button onClick={() => setShowCreate(true)} className="btn-primary">+ Новая беседа</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <motion.div
                key={`${it.kind}-${it.kind === "dm" ? it.t.peer_id : it.t.room_id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {it.kind === "dm" ? <DMRow t={it.t} /> : <GroupRow t={it.t} />}
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showCreate && (
          <CreateChatModal
            onClose={() => setShowCreate(false)}
            onCreated={(rid) => {
              setShowCreate(false);
              nav(`/chats/${rid}`);
            }}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function DMRow({ t }: { t: Thread }) {
  return (
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
              {fmtTime(t.last_message_at)}
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
  );
}

function GroupRow({ t }: { t: ChatThread }) {
  return (
    <Link
      to={`/chats/${t.room_id}`}
      className="card p-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-soft transition-all"
    >
      <div className="relative shrink-0">
        <Avatar name={t.title} photo={t.photo} size={48} />
        <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border-2 border-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold truncate">{t.title}</div>
          {t.last_message_at && (
            <div className="text-xs text-ink/40 shrink-0">
              {fmtTime(t.last_message_at)}
            </div>
          )}
        </div>
        {t.last_message_text ? (
          <div className="text-sm text-ink/60 truncate">
            {t.last_from_name && <span className="text-ink/45">{t.last_from_name}: </span>}
            {t.last_message_text}
          </div>
        ) : (
          <div className="text-sm text-ink/40 italic truncate">Беседа создана</div>
        )}
      </div>
    </Link>
  );
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function CreateChatModal({ onClose, onCreated }: { onClose: () => void; onCreated: (roomId: string) => void }) {
  const [title, setTitle] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    friendsApi.list().then(setFriends);
  }, []);

  const filtered = friends.filter((f) => !q.trim() || f.name.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Дайте беседе название");
      return;
    }
    if (picked.size === 0) {
      toast.error("Выберите хотя бы одного друга");
      return;
    }
    setBusy(true);
    try {
      const room = await chatsApi.create(title.trim(), Array.from(picked));
      onCreated(room.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Не получилось создать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-extrabold text-xl">Новая беседа</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink p-2">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Название</label>
            <input
              className="input"
              placeholder="Например: Парк-выгул выходные"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={80}
            />
          </div>
          <div>
            <label className="label">Кого добавить ({picked.size})</label>
            {friends.length === 0 ? (
              <div className="text-sm text-ink/50">У вас пока нет друзей</div>
            ) : (
              <>
                <input
                  className="input mb-2"
                  placeholder="Поиск..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {filtered.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(f.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition ${
                        picked.has(f.id) ? "bg-brand-100" : "hover:bg-brand-50"
                      }`}
                    >
                      <Avatar name={f.name} photo={f.photo} size={36} />
                      <div className="flex-1 truncate text-sm font-semibold">{f.name}</div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        picked.has(f.id) ? "bg-brand-500 border-brand-500 text-white" : "border-brand-200"
                      }`}>
                        {picked.has(f.id) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1">Отмена</button>
          <button onClick={submit} disabled={busy} className="btn-primary flex-1">
            {busy ? "Создаём..." : "Создать"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
