import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { friendsApi, postsApi, usersApi } from "../api";
import type { Post, PublicUser } from "../types";
import { PageTransition } from "../components/PageTransition";
import { PostCard, Avatar } from "../components/PostCard";

export function UserProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!id) return;
    const [u, p] = await Promise.all([usersApi.get(id), postsApi.ofUser(id)]);
    setUser(u);
    setPosts(p);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (user?.relation === "self") nav("/profile");
  }, [user, nav]);

  if (loading || !user) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto px-6 pt-10 space-y-4">
          <div className="card h-32 skeleton" />
          <div className="card h-24 skeleton" />
        </div>
      </PageTransition>
    );
  }

  const act = async (kind: "request" | "accept" | "reject" | "remove") => {
    try {
      if (kind === "request") await friendsApi.request(user.id);
      if (kind === "accept") await friendsApi.accept(user.id);
      if (kind === "reject") await friendsApi.reject(user.id);
      if (kind === "remove") await friendsApi.remove(user.id);
      reload();
      toast.success("Готово");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <PageTransition>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 flex flex-wrap items-center gap-5"
        >
          <Avatar name={user.name} photo={user.photo} size={88} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-2xl truncate">{user.name}</div>
            <div className="text-ink/60 text-sm truncate">{user.email}</div>
          </div>
          <div className="flex gap-2">
            {user.relation === "stranger" && (
              <button className="btn-primary !py-2 text-sm" onClick={() => act("request")}>
                Добавить в друзья
              </button>
            )}
            {user.relation === "request_sent" && (
              <span className="chip">Заявка отправлена</span>
            )}
            {user.relation === "request_received" && (
              <>
                <button className="btn-primary !py-2 text-sm" onClick={() => act("accept")}>
                  Принять
                </button>
                <button className="btn-ghost !py-2 text-sm" onClick={() => act("reject")}>
                  Отклонить
                </button>
              </>
            )}
            {user.relation === "friend" && (
              <>
                <Link to={`/messages/${user.id}`} className="btn-primary !py-2 text-sm">
                  Написать
                </Link>
                <button
                  className="btn-ghost !py-2 text-sm"
                  onClick={() => {
                    if (confirm("Удалить из друзей?")) act("remove");
                  }}
                >
                  Удалить
                </button>
              </>
            )}
          </div>
        </motion.div>

        <div className="text-xs font-bold uppercase tracking-widest text-ink/50 pt-2">
          Посты ({posts.length})
        </div>

        {posts.length === 0 ? (
          <div className="card p-8 text-center text-ink/60">Постов пока нет</div>
        ) : (
          posts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
        )}
      </section>
    </PageTransition>
  );
}
