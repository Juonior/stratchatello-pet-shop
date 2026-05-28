import { useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { postsApi, uploadApi } from "../api";
import type { Post } from "../types";
import { useAuth } from "../store";
import { Avatar } from "./PostCard";

interface Props {
  onPosted: (post: Post) => void;
}

export function PostComposer({ onPosted }: Props) {
  const me = useAuth((s) => s.user);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
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

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const post = await postsApi.create(text.trim(), image);
      setText("");
      setImage(null);
      onPosted(post);
      toast.success("Пост опубликован");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar name={me.name} photo={me.photo} size={44} />
        <div className="flex-1">
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
              onClick={submit}
              disabled={busy || !text.trim()}
              className="btn-primary text-sm"
            >
              {busy ? "Постим..." : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
