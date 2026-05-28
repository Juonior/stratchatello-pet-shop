import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { authApi, ordersApi, postsApi } from "../api";
import type { Order, Post } from "../types";
import { useAuth } from "../store";
import { PageTransition } from "../components/PageTransition";
import { AvatarUploader } from "../components/AvatarUploader";
import { PostCard } from "../components/PostCard";
import { PostComposer } from "../components/PostComposer";

export function Profile() {
  const { user, isAuth, logout, setSession, token } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"posts" | "orders">("posts");
  const [orders, setOrders] = useState<Order[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const updatePhoto = async (photo: string | null) => {
    try {
      const u = await authApi.updateMe({ photo });
      if (token) setSession(token, u);
      toast.success(photo ? "Фото обновлено" : "Фото удалено");
    } catch {
      toast.error("Не удалось обновить фото");
    }
  };

  useEffect(() => {
    if (!isAuth) {
      nav("/login");
      return;
    }
    Promise.all([ordersApi.list(), user ? postsApi.ofUser(user.id) : Promise.resolve([] as Post[])])
      .then(([o, p]) => {
        setOrders(o);
        setPosts(p);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth, nav]);

  const handlePosted = (p: Post) => setPosts([p, ...posts]);
  const handleDeletePost = async (id: string) => {
    if (!confirm("Удалить пост?")) return;
    try {
      await postsApi.remove(id);
      setPosts(posts.filter((p) => p.id !== id));
      toast.success("Пост удалён");
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  if (!user) return null;

  return (
    <PageTransition>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-6 flex flex-wrap items-center gap-5"
        >
          <AvatarUploader
            kind="user"
            value={user.photo}
            onChange={updatePhoto}
            size={84}
            fallback={
              <div className="w-full h-full bg-gradient-to-br from-brand-500 to-rose-500 text-white flex items-center justify-center font-display font-extrabold text-3xl">
                {user.name[0]?.toUpperCase() || "?"}
              </div>
            }
            label="Сменить аватар"
          />
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-2xl truncate">{user.name}</div>
            <div className="text-ink/60 text-sm truncate">{user.email}</div>
          </div>
          <button onClick={logout} className="btn-ghost !py-2 text-sm">Выйти</button>
        </motion.div>

        <div className="flex gap-1 border-b border-brand-100 mb-5">
          <TabBtn active={tab === "posts"} onClick={() => setTab("posts")} label={`Посты (${posts.length})`} />
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} label={`Заказы (${orders.length})`} />
        </div>

        {tab === "posts" && (
          <div className="space-y-3">
            <PostComposer onPosted={handlePosted} />
            {loading ? (
              <div className="card h-32 skeleton" />
            ) : posts.length === 0 ? (
              <div className="card p-8 text-center text-ink/60">
                Ещё нет постов — напишите первый!
              </div>
            ) : (
              posts.map((p, i) => (
                <PostCard key={p.id} post={p} onDelete={handleDeletePost} index={i} />
              ))
            )}
          </div>
        )}

        {tab === "orders" && (
          loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-28 skeleton" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="font-display font-extrabold text-xl">Заказов пока нет</div>
              <p className="text-ink/60 mt-1">Здесь будет история ваших покупок.</p>
              <button onClick={() => nav("/catalog")} className="btn-primary mt-5">В каталог</button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="text-xs text-ink/50">Заказ № {o.id.slice(0, 8).toUpperCase()}</div>
                      <div className="font-semibold mt-1">
                        {new Date(o.created_at).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-extrabold text-xl">
                        {o.total.toLocaleString("ru-RU")} ₽
                      </div>
                      <div className={`text-xs font-semibold mt-1 ${o.status === "paid" ? "text-green-600" : "text-ink/60"}`}>
                        {o.status === "paid" ? "✓ Оплачено" : o.status}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-ink/60">
                    {o.address} · {o.delivery_time}
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {o.items.slice(0, 6).map((it, idx) => (
                      <div key={idx} className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-brand-50">
                        {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                    {o.items.length > 6 && (
                      <div className="shrink-0 w-14 h-14 rounded-lg bg-brand-50 flex items-center justify-center text-sm font-bold text-ink/60">
                        +{o.items.length - 6}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </section>
    </PageTransition>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold transition ${
        active ? "text-brand-600" : "text-ink/50 hover:text-ink/80"
      }`}
    >
      {label}
      {active && (
        <motion.div
          layoutId="profile-tab-underline"
          className="absolute left-2 right-2 bottom-0 h-0.5 bg-brand-500 rounded"
        />
      )}
    </button>
  );
}
