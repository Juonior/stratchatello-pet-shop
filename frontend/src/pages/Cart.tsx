import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth, useCart } from "../store";
import { PageTransition } from "../components/PageTransition";

export function CartPage() {
  const { cart, setQty, remove, clear } = useCart();
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();

  if (!isAuth) {
    return (
      <PageTransition>
        <Empty
          title="Войдите в аккаунт"
          subtitle="Корзина появится после входа"
          cta="Войти"
          onClick={() => nav("/login")}
        />
      </PageTransition>
    );
  }

  if (cart.items.length === 0) {
    return (
      <PageTransition>
        <Empty
          title="Корзина пуста"
          subtitle="Самое время выбрать что-то для собаки"
          cta="В каталог"
          onClick={() => nav("/catalog")}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mb-6">Корзина</h1>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {cart.items.map((it, i) => (
                <motion.div
                  key={it.product_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                  className="card p-4 flex gap-4 items-center"
                >
                  <Link to={`/product/${it.product_id}`} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-brand-50">
                    {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${it.product_id}`} className="font-semibold hover:text-brand-600 line-clamp-1">
                      {it.title}
                    </Link>
                    <div className="text-sm text-ink/50 mt-1">
                      {it.price.toLocaleString("ru-RU")} ₽ / шт
                    </div>
                  </div>
                  <div className="flex items-center border-2 border-brand-100 rounded-xl">
                    <button
                      onClick={() => setQty(it.product_id, Math.max(0, it.quantity - 1))}
                      className="px-3 py-2 font-bold text-lg hover:bg-brand-50"
                    >−</button>
                    <div className="px-3 font-bold min-w-[2rem] text-center">{it.quantity}</div>
                    <button
                      onClick={() => setQty(it.product_id, it.quantity + 1)}
                      className="px-3 py-2 font-bold text-lg hover:bg-brand-50"
                    >+</button>
                  </div>
                  <div className="font-display font-bold text-lg min-w-[110px] text-right">
                    {it.subtotal.toLocaleString("ru-RU")} ₽
                  </div>
                  <button
                    onClick={() => remove(it.product_id)}
                    className="text-ink/40 hover:text-red-500 p-2"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button onClick={clear} className="text-sm text-ink/50 hover:text-red-500 px-2 py-2">
              Очистить корзину
            </button>
          </div>

          <div className="card p-6 h-fit lg:sticky lg:top-24">
            <div className="font-display font-extrabold text-xl mb-4">Итого</div>
            <div className="flex justify-between mb-2 text-ink/70">
              <span>Товары ({cart.count})</span>
              <span>{cart.total.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between mb-2 text-ink/70">
              <span>Доставка</span>
              <span className="text-green-600 font-semibold">
                {cart.total >= 2990 ? "Бесплатно" : "от 290 ₽"}
              </span>
            </div>
            <div className="border-t border-brand-100 my-4" />
            <div className="flex justify-between items-end mb-5">
              <span className="text-ink/60">К оплате</span>
              <span className="font-display font-extrabold text-2xl">
                {cart.total.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => nav("/checkout")}
              className="btn-primary w-full text-base"
            >
              Оформить заказ →
            </motion.button>
            <div className="text-xs text-ink/50 text-center mt-3">
              Безопасная оплата · возврат 14 дней
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

function Empty({
  title, subtitle, cta, onClick,
}: { title: string; subtitle: string; cta: string; onClick: () => void }) {
  return (
    <section className="max-w-2xl mx-auto px-6 pt-24 pb-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display font-extrabold text-3xl">{title}</h1>
        <p className="text-ink/60 mt-2 mb-6">{subtitle}</p>
        <button onClick={onClick} className="btn-primary">{cta}</button>
      </motion.div>
    </section>
  );
}
