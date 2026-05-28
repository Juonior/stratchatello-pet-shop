import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import type { Comment, Post } from "../types";
import { useAuth } from "../store";
import { commentsApi } from "../api";

interface Props {
  post: Post;
  onDelete?: (id: string) => void;
  sectionLabel?: string;
  index?: number;
}

export function PostCard({ post, onDelete, sectionLabel, index = 0 }: Props) {
  const me = useAuth((s) => s.user);
  const isMine = me?.id === post.user_id;
  const created = new Date(post.created_at);

  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const loadComments = async () => {
    if (comments !== null) return;
    setLoading(true);
    try {
      const c = await commentsApi.list(post.id);
      setComments(c);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!open) await loadComments();
    setOpen((o) => !o);
  };

  const submit = async () => {
    if (!text.trim() || !me) return;
    setSending(true);
    try {
      const c = await commentsApi.add(post.id, text.trim());
      setComments((prev) => [...(prev || []), c]);
      setText("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Не отправилось");
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (cid: string) => {
    try {
      await commentsApi.remove(post.id, cid);
      setComments((prev) => prev?.filter((c) => c.id !== cid) || null);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.4 }}
      className="card p-5"
    >
      <div className="flex items-start gap-3">
        <Link to={`/users/${post.user_id}`} className="shrink-0">
          <Avatar name={post.user_name} photo={post.user_photo} size={44} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              to={`/users/${post.user_id}`}
              className="font-display font-bold hover:text-brand-600"
            >
              {post.user_name}
            </Link>
            {sectionLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">
                {sectionLabel}
              </span>
            )}
          </div>
          <div className="text-xs text-ink/50">
            {created.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
        {isMine && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="text-ink/40 hover:text-red-500 p-1.5"
            aria-label="Удалить пост"
            title="Удалить пост"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
            </svg>
          </button>
        )}
      </div>
      {post.text && (
        <p className="mt-3 whitespace-pre-line text-ink/85 leading-relaxed">{post.text}</p>
      )}
      {post.video && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-brand-100 bg-black">
          <video
            src={post.video}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[600px] block mx-auto"
          />
        </div>
      )}
      {post.image && !post.video && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-brand-100">
          <img src={post.image} alt="" className="w-full max-h-[480px] object-cover" />
        </div>
      )}

      {/* Comments toggle */}
      <button
        onClick={toggle}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-brand-600 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        Комментарии{comments ? ` · ${comments.length}` : ""}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 border-t border-brand-100 overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {loading ? (
                <div className="text-sm text-ink/50">Загружаем...</div>
              ) : (
                <>
                  {(comments || []).map((c) => (
                    <CommentItem
                      key={c.id}
                      c={c}
                      canDelete={me?.id === c.user_id || me?.id === post.user_id}
                      onDelete={() => removeComment(c.id)}
                    />
                  ))}
                  {(comments || []).length === 0 && (
                    <div className="text-sm text-ink/50">Пока ни одного комментария</div>
                  )}
                </>
              )}

              {me && (
                <div className="flex items-start gap-2.5">
                  <Avatar name={me.name} photo={me.photo} size={32} />
                  <div className="flex-1 flex gap-2">
                    <input
                      className="input !py-2 text-sm flex-1"
                      placeholder="Написать комментарий..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      maxLength={1000}
                    />
                    <button
                      onClick={submit}
                      disabled={sending || !text.trim()}
                      className="btn-primary !py-2 !px-3 text-sm"
                      aria-label="Отправить"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function CommentItem({ c, canDelete, onDelete }: { c: Comment; canDelete: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-2.5 group">
      <Link to={`/users/${c.user_id}`} className="shrink-0">
        <Avatar name={c.user_name} photo={c.user_photo} size={32} />
      </Link>
      <div className="flex-1 min-w-0 bg-brand-50/60 rounded-2xl px-3.5 py-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link to={`/users/${c.user_id}`} className="font-semibold text-sm hover:text-brand-600">
            {c.user_name}
          </Link>
          <div className="text-[11px] text-ink/40">
            {new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="text-sm text-ink/85 whitespace-pre-line break-words">{c.text}</div>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="text-ink/30 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition"
          title="Удалить"
          aria-label="Удалить комментарий"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover bg-brand-50"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="rounded-full bg-gradient-to-br from-brand-500 to-rose-500 text-white flex items-center justify-center font-display font-bold"
    >
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}
