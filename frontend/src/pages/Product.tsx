import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { catalogApi, reviewsApi } from "../api";
import type { Product, Review } from "../types";
import { useAuth, useCart } from "../store";
import { PageTransition } from "../components/PageTransition";

export function ProductPage() {
  const { id } = useParams();
  const [p, setP] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"about" | "composition" | "instruction" | "reviews">("about");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const add = useCart((s) => s.add);
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;
    catalogApi.product(id).then(setP);
    reviewsApi.list(id).then(setReviews);
  }, [id]);

  if (!p) {
    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 grid lg:grid-cols-2 gap-8">
          <div className="aspect-square skeleton" />
          <div className="space-y-4">
            <div className="skeleton h-4 w-1/4" />
            <div className="skeleton h-10 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </PageTransition>
    );
  }

  const onAdd = async () => {
    if (!isAuth) {
      toast("Войдите, чтобы добавить в корзину", { icon: "🔒" });
      nav("/login");
      return;
    }
    await add(p.id, qty);
    toast.success(`«${p.title}» × ${qty} в корзине`);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuth) {
      toast("Войдите, чтобы оставить отзыв", { icon: "🔒" });
      nav("/login");
      return;
    }
    if (reviewText.trim().length < 3) return;
    setSubmitting(true);
    try {
      const r = await reviewsApi.add(p.id, { rating: reviewRating, text: reviewText });
      setReviews([r, ...reviews]);
      setReviewText("");
      toast.success("Спасибо за отзыв!");
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="aspect-square rounded-3xl overflow-hidden bg-brand-50 sticky top-24 self-start"
          >
            {p.image ? (
              <motion.img
                src={p.image}
                alt={p.title}
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.5 }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-9xl">🐶</div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            {p.brand && (
              <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
                {p.brand}
              </div>
            )}
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">{p.title}</h1>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className="text-yellow-500 text-lg">★</span>
              <span className="font-bold">{p.rating.toFixed(1)}</span>
              <span className="text-ink/50">· {p.rating_count} отзывов</span>
              <span className="mx-2 text-ink/30">·</span>
              <span className={p.in_stock ? "text-green-600 font-semibold" : "text-red-500"}>
                {p.in_stock ? "В наличии" : "Нет в наличии"}
              </span>
            </div>

            <div className="mt-6 flex items-end gap-3">
              {p.old_price && p.old_price > p.price && (
                <span className="text-xl text-ink/40 line-through">
                  {p.old_price.toLocaleString("ru-RU")} ₽
                </span>
              )}
              <span className="font-display font-extrabold text-4xl">
                {p.price.toLocaleString("ru-RU")} ₽
              </span>
            </div>

            <div className="mt-6 flex items-stretch gap-3">
              <div className="flex items-center border-2 border-brand-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-4 py-3 hover:bg-brand-50 text-xl font-bold"
                >
                  −
                </button>
                <div className="px-4 font-bold min-w-[2.5rem] text-center">{qty}</div>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="px-4 py-3 hover:bg-brand-50 text-xl font-bold"
                >
                  +
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onAdd}
                disabled={!p.in_stock}
                className="btn-primary flex-1 text-base"
              >
                В корзину · {(p.price * qty).toLocaleString("ru-RU")} ₽
              </motion.button>
            </div>

            {p.tags?.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span key={t} className="chip">#{t}</span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="mt-10">
              <div className="flex flex-wrap gap-1 border-b border-brand-100">
                {([
                  ["about", "Описание"],
                  ["composition", "Состав"],
                  ["instruction", "Инструкция"],
                  ["reviews", `Отзывы (${reviews.length})`],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`relative px-4 py-2.5 text-sm font-semibold transition ${
                      tab === k ? "text-brand-600" : "text-ink/50 hover:text-ink/80"
                    }`}
                  >
                    {label}
                    {tab === k && (
                      <motion.div
                        layoutId="tab-underline"
                        className="absolute left-2 right-2 bottom-0 h-0.5 bg-brand-500 rounded"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-5 leading-relaxed text-ink/80 min-h-[120px]">
                {tab === "about" && <p>{p.description || "Описание не указано."}</p>}
                {tab === "composition" && <p>{p.composition || "Состав не указан."}</p>}
                {tab === "instruction" && <p>{p.instruction || "Инструкция не указана."}</p>}
                {tab === "reviews" && (
                  <div className="space-y-5">
                    <form onSubmit={submitReview} className="card p-4 space-y-3">
                      <div className="font-semibold">Оставить отзыв</div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            type="button"
                            key={n}
                            onClick={() => setReviewRating(n)}
                            className={`text-2xl transition ${
                              n <= reviewRating ? "text-yellow-500" : "text-ink/20"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="input min-h-[80px]"
                        placeholder="Что понравилось вашему хвостику?"
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                      />
                      <button className="btn-primary text-sm" disabled={submitting}>
                        Отправить отзыв
                      </button>
                    </form>

                    {reviews.length === 0 ? (
                      <div className="text-ink/50 text-center py-6">
                        Пока отзывов нет — будьте первым!
                      </div>
                    ) : (
                      reviews.map((r) => (
                        <div key={r.id} className="card p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-pink-400 text-white flex items-center justify-center font-bold">
                              {r.user_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <div className="font-semibold">{r.user_name}</div>
                              <div className="text-xs text-ink/50">
                                {new Date(r.created_at).toLocaleDateString("ru-RU")}
                              </div>
                            </div>
                            <div className="ml-auto text-yellow-500">
                              {"★".repeat(r.rating)}<span className="text-ink/20">{"★".repeat(5 - r.rating)}</span>
                            </div>
                          </div>
                          <p className="mt-3 text-ink/80">{r.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </PageTransition>
  );
}
