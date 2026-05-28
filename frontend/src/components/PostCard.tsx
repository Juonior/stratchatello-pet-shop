import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Post } from "../types";
import { useAuth } from "../store";

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
      <p className="mt-3 whitespace-pre-line text-ink/85 leading-relaxed">{post.text}</p>
      {post.image && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-brand-100">
          <img src={post.image} alt="" className="w-full max-h-[480px] object-cover" />
        </div>
      )}
    </motion.article>
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
