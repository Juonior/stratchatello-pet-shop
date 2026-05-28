import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { chatsApi, friendsApi } from "../api";
import type { ChatMessage, ChatRoom, Friend } from "../types";
import { PageTransition } from "../components/PageTransition";
import { Avatar } from "../components/PostCard";
import { useAuth } from "../store";

const POLL_MS = 4000;

export function GroupChat() {
  const { roomId } = useParams();
  const isAuth = useAuth((s) => s.isAuth);
  const me = useAuth((s) => s.user);
  const nav = useNavigate();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuth) { nav("/login"); return; }
    if (!roomId) return;
    chatsApi.get(roomId).then(setRoom).catch(() => nav("/messages"));
  }, [roomId, isAuth, nav]);

  useEffect(() => {
    if (!roomId || !isAuth) return;
    let cancelled = false;
    const refresh = () => chatsApi.messages(roomId).then((m) => { if (!cancelled) setMessages(m); });
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [roomId, isAuth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !roomId) return;
    setBusy(true);
    try {
      const m = await chatsApi.send(roomId, text.trim());
      setMessages((prev) => [...prev, m]);
      setText("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Не отправилось");
    } finally {
      setBusy(false);
    }
  };

  if (!room) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto px-6 pt-10 space-y-3">
          <div className="card h-16 skeleton" />
          <div className="card h-24 skeleton" />
        </div>
      </PageTransition>
    );
  }

  const isCreator = room.created_by === me?.id;

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-4 h-[calc(100vh-7rem)] flex flex-col">
        {/* Header */}
        <button
          onClick={() => setShowMembers(true)}
          className="card p-3 flex items-center gap-3 mb-3 hover:border-brand-300 transition w-full text-left"
        >
          <button
            onClick={(e) => { e.stopPropagation(); nav("/messages"); }}
            className="text-ink/60 hover:text-brand-600 p-1"
            aria-label="Назад"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <Avatar name={room.title} photo={room.photo} size={44} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{room.title}</div>
            <div className="text-xs text-ink/50">
              {room.members.length} участн{room.members.length === 1 ? "ик" : room.members.length < 5 ? "ика" : "иков"}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/40">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto card p-4 space-y-2.5">
          {messages.length === 0 && (
            <div className="text-center text-ink/50 text-sm py-12">
              Беседа создана — напишите первое сообщение
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showAuthor = !m.mine && (!prev || prev.from_user_id !== m.from_user_id);
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${m.mine ? "justify-end" : "justify-start"}`}
                >
                  {!m.mine && (
                    <div className="shrink-0 w-7">
                      {showAuthor && <Avatar name={m.from_name} photo={m.from_photo} size={28} />}
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${
                      m.mine
                        ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-sm"
                        : "bg-brand-50 text-ink rounded-bl-sm"
                    }`}
                  >
                    {showAuthor && (
                      <div className="text-xs font-semibold text-brand-700 mb-0.5">{m.from_name}</div>
                    )}
                    <div className="whitespace-pre-line break-words">{m.text}</div>
                    <div className={`text-[10px] mt-1 ${m.mine ? "text-white/70" : "text-ink/45"}`}>
                      {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
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

      <AnimatePresence>
        {showMembers && (
          <MembersModal
            room={room}
            isCreator={isCreator}
            myId={me?.id || ""}
            onClose={() => setShowMembers(false)}
            onChanged={(r) => setRoom(r)}
            onLeft={() => nav("/messages")}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function MembersModal({
  room, isCreator, myId, onClose, onChanged, onLeft,
}: {
  room: ChatRoom;
  isCreator: boolean;
  myId: string;
  onClose: () => void;
  onChanged: (room: ChatRoom) => void;
  onLeft: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const memberIds = new Set(room.members.map((m) => m.id));

  useEffect(() => {
    if (showAdd) friendsApi.list().then(setFriends);
  }, [showAdd]);

  const remove = async (uid: string) => {
    if (!confirm(uid === myId ? "Выйти из беседы?" : "Удалить участника?")) return;
    try {
      await chatsApi.removeMember(room.id, uid);
      if (uid === myId) onLeft();
      else onChanged(await chatsApi.get(room.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка");
    }
  };

  const addOne = async (uid: string) => {
    try {
      const r = await chatsApi.addMember(room.id, uid);
      onChanged(r);
      toast.success("Добавлен");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка");
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
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-extrabold text-xl">{room.title}</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink p-2">✕</button>
        </div>

        {!showAdd ? (
          <>
            <div className="text-xs uppercase tracking-widest text-ink/50 font-bold mb-2">
              Участники ({room.members.length})
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {room.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-50">
                  <Link to={`/users/${m.id}`} onClick={onClose}>
                    <Avatar name={m.name} photo={m.photo} size={36} />
                  </Link>
                  <Link to={`/users/${m.id}`} onClick={onClose} className="flex-1 truncate text-sm font-semibold hover:text-brand-600">
                    {m.name}{m.id === room.created_by && <span className="text-xs text-ink/40 ml-2">создатель</span>}
                  </Link>
                  {(m.id === myId || isCreator) && (
                    <button
                      onClick={() => remove(m.id)}
                      className="text-ink/30 hover:text-red-500 text-xs px-2 py-1"
                    >
                      {m.id === myId ? "Выйти" : "Удалить"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-soft w-full mt-4 text-sm">
              + Добавить друзей
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowAdd(false)} className="text-sm text-brand-600 hover:underline mb-3">
              ← К участникам
            </button>
            <div className="text-xs uppercase tracking-widest text-ink/50 font-bold mb-2">
              Ваши друзья
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-50">
                  <Avatar name={f.name} photo={f.photo} size={36} />
                  <div className="flex-1 truncate text-sm font-semibold">{f.name}</div>
                  {memberIds.has(f.id) ? (
                    <span className="text-xs text-ink/40">уже в беседе</span>
                  ) : (
                    <button onClick={() => addOne(f.id)} className="btn-soft !py-1.5 text-xs">
                      Добавить
                    </button>
                  )}
                </div>
              ))}
              {friends.length === 0 && (
                <div className="text-sm text-ink/50 text-center py-6">У вас нет друзей</div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
