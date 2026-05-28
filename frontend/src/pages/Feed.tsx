import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { feedApi, postsApi } from "../api";
import type { FeedItem, Post } from "../types";
import { PageTransition } from "../components/PageTransition";
import { PostCard } from "../components/PostCard";
import { PostComposer } from "../components/PostComposer";
import { useAuth } from "../store";

export function Feed() {
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth) return;
    feedApi.get().then(setItems).finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) {
    return (
      <PageTransition>
        <section className="max-w-2xl mx-auto px-6 pt-20 pb-20 text-center">
          <h1 className="font-display font-extrabold text-3xl">Войдите, чтобы читать ленту</h1>
          <p className="text-ink/60 mt-2">Посты друзей и рекомендации — только для зарегистрированных.</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => nav("/login")} className="btn-primary">Войти</button>
            <button onClick={() => nav("/register")} className="btn-ghost">Регистрация</button>
          </div>
        </section>
      </PageTransition>
    );
  }

  const handlePosted = async (p: Post) => {
    // refresh feed to ensure server-side ordering
    const fresh = await feedApi.get();
    setItems(fresh);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Удалить пост?")) return;
    try {
      await postsApi.remove(postId);
      setItems(items.filter((i) => i.post.id !== postId));
      toast.success("Пост удалён");
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const friendPosts = items.filter((i) => i.section === "friends");
  const discoverPosts = items.filter((i) => i.section === "discover");

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Лента</div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">Что у друзей</h1>
        </div>

        <PostComposer onPosted={handlePosted} />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-32 skeleton" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="font-display font-extrabold text-xl">Здесь пока пусто</div>
            <p className="text-ink/60 mt-1">Найдите друзей или напишите свой первый пост.</p>
            <button onClick={() => nav("/users")} className="btn-primary mt-5">Найти друзей</button>
          </div>
        ) : (
          <>
            {friendPosts.length > 0 && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-ink/50 pt-2">
                  Посты друзей
                </div>
                {friendPosts.map((it, i) => (
                  <PostCard key={it.post.id} post={it.post} onDelete={handleDelete} index={i} />
                ))}
              </>
            )}
            {discoverPosts.length > 0 && (
              <>
                <div className="text-xs font-bold uppercase tracking-widest text-ink/50 pt-4">
                  Рекомендации
                </div>
                {discoverPosts.map((it, i) => (
                  <PostCard
                    key={it.post.id}
                    post={it.post}
                    onDelete={handleDelete}
                    sectionLabel="советуем"
                    index={i}
                  />
                ))}
              </>
            )}
          </>
        )}
      </section>
    </PageTransition>
  );
}
