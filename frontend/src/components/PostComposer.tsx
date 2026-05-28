import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { postsApi, uploadApi } from "../api";
import type { Post } from "../types";
import { useAuth } from "../store";
import { Avatar } from "./PostCard";

interface Props {
  onPosted: (post: Post) => void;
}

type Mode = "text" | "url";

export function PostComposer({ onPosted }: Props) {
  const me = useAuth((s) => s.user);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!me) return null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Только изображения");
      return;
    }
    setBusy(true);
    try {
      const r = await uploadApi.image(f, "misc");
      setImage(r.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  const submitText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const post = await postsApi.create(text.trim(), image);
      reset();
      onPosted(post);
      toast.success("Пост опубликован");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  };

  const submitUrl = async () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      toast.error("Введите полный URL (с http:// или https://)");
      return;
    }
    setBusy(true);
    const tid = toast.loading("Скачиваем видео...");
    try {
      const post = await postsApi.fromUrl(u, text.trim());
      reset();
      onPosted(post);
      toast.success("Видео загружено", { id: tid });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Не удалось скачать видео", { id: tid });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setText("");
    setImage(null);
    setUrl("");
    setMode("text");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar name={me.name} photo={me.photo} size={44} />
        <div className="flex-1 min-w-0">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-3">
            <ModeBtn active={mode === "text"} onClick={() => setMode("text")}>
              Пост
            </ModeBtn>
            <ModeBtn active={mode === "url"} onClick={() => setMode("url")}>
              Видео по ссылке
            </ModeBtn>
          </div>

          <AnimatePresence mode="wait">
            {mode === "text" ? (
              <motion.div
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <textarea
                  className="input min-h-[80px] resize-none"
                  placeholder={`Что нового, ${me.name}?`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                />
                {image && (
                  <div className="mt-3 relative rounded-2xl overflow-hidden border border-brand-100">
                    <img src={image} alt="" className="w-full max-h-72 object-cover" />
                    <button
                      onClick={() => setImage(null)}
                      className="absolute top-2 right-2 bg-white/95 rounded-full w-8 h-8 flex items-center justify-center shadow text-ink/70 hover:text-red-500"
                      aria-label="Убрать фото"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="btn-ghost !py-2 text-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Добавить фото
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                  <button
                    onClick={submitText}
                    disabled={busy || !text.trim()}
                    className="btn-primary text-sm"
                  >
                    {busy ? "Постим..." : "Опубликовать"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="url"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <input
                  className="input"
                  placeholder="https://www.tiktok.com/@user/video/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                  autoFocus
                />
                <textarea
                  className="input min-h-[60px] resize-none mt-2"
                  placeholder="Описание (необязательно)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  disabled={busy}
                />
                <div className="mt-2 text-xs text-ink/50">
                  Поддерживаем: TikTok, YouTube Shorts, Instagram Reels, Twitter/X и др.
                  Скачивание занимает 10–30 секунд. Лимит — 40 МБ.
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={submitUrl}
                    disabled={busy || !url.trim()}
                    className="btn-primary text-sm"
                  >
                    {busy ? "Скачиваем..." : "Опубликовать видео"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
        active ? "bg-brand-100 text-brand-700" : "text-ink/40 hover:text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}
