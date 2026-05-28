import { useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { uploadApi } from "../api";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  kind?: "user" | "pet";
  size?: number;
  fallback?: React.ReactNode;
  label?: string;
}

const DefaultFallback = (
  <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500/70">
    <path d="M21 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export function AvatarUploader({
  value,
  onChange,
  kind = "user",
  size = 96,
  fallback,
  label = "Загрузить фото",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Только изображения");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Максимум 5 МБ");
      return;
    }
    setBusy(true);
    try {
      const r = await uploadApi.image(f, kind);
      onChange(r.url);
      toast.success("Загружено");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={pick}
        style={{ width: size, height: size }}
        className="rounded-full bg-gradient-to-br from-brand-100 to-pink-100 border-2 border-brand-200 overflow-hidden cursor-pointer relative group flex items-center justify-center shrink-0"
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          fallback ?? DefaultFallback
        )}
        <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
          {busy ? "..." : "✎"}
        </div>
      </motion.div>
      <div className="flex flex-col gap-1.5 items-start">
        <button type="button" onClick={pick} disabled={busy} className="btn-ghost !py-2 text-sm">
          {busy ? "Загружаем..." : label}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-ink/50 hover:text-red-500"
          >
            Удалить
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handle}
        />
      </div>
    </div>
  );
}
