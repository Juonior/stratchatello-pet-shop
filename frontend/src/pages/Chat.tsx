import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { messagesApi, usersApi } from "../api";
import type { Message, PublicUser } from "../types";
import { PageTransition } from "../components/PageTransition";
import { Avatar } from "../components/PostCard";
import { useAuth } from "../store";

const POLL_MS = 4000;

export function Chat() {
  const { peerId } = useParams();
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [peer, setPeer] = useState<PublicUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuth) {
      nav("/login");
      return;
    }
    if (!peerId) return;
    usersApi.get(peerId).then(setPeer).catch(() => nav("/messages"));
  }, [peerId, isAuth, nav]);

  useEffect(() => {
    if (!peerId || !isAuth) return;
    let cancelled = false;
    const refresh = () => messagesApi.list(peerId).then((m) => { if (!cancelled) setMessages(m); });
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [peerId, isAuth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!peer) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto px-6 pt-10 space-y-3">
          <div className="card h-16 skeleton" />
          <div className="card h-24 skeleton" />
        </div>
      </PageTransition>
    );
  }

  const send = async () => {
    if (!text.trim() || !peerId) return;
    setBusy(true);
    try {
      const m = await messagesApi.send(peerId, text.trim());
      setMessages((prev) => [...prev, m]);
      setText("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Не отправилось");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-4 h-[calc(100vh-7rem)] flex flex-col">
        {/* Header */}
        <Link
          to={`/users/${peer.id}`}
          className="card p-3 flex items-center gap-3 mb-3 hover:border-brand-300 transition"
        >
          <button
            onClick={(e) => { e.preventDefault(); nav("/messages"); }}
            className="text-ink/60 hover:text-brand-600 p-1"
            aria-label="Назад"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <Avatar name={peer.name} photo={peer.photo} size={44} />
          <div>
            <div className="font-semibold">{peer.name}</div>
            <div className="text-xs text-ink/50">
              {peer.relation === "friend" ? "Друг" : peer.email}
            </div>
          </div>
        </Link>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto card p-4 space-y-2.5">
          {messages.length === 0 && (
            <div className="text-center text-ink/50 text-sm py-12">
              Начните разговор — напишите первое сообщение
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2 rounded-2xl ${
                    m.mine
                      ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-sm"
                      : "bg-brand-50 text-ink rounded-bl-sm"
                  }`}
                >
                  <div className="whitespace-pre-line break-words">{m.text}</div>
                  <div className={`text-[10px] mt-1 ${m.mine ? "text-white/70" : "text-ink/45"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            maxLength={2000}
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            className="btn-primary !px-4"
            aria-label="Отправить"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </section>
    </PageTransition>
  );
}
