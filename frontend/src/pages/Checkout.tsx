import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { ordersApi, paymentsApi } from "../api";
import { useAuth, useCart } from "../store";
import { PageTransition } from "../components/PageTransition";

const STEPS = ["Адрес", "Время", "Оплата", "Подтверждение"] as const;

export function Checkout() {
  const { cart, refresh } = useCart();
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("");
  const [pay, setPay] = useState<"card" | "cash" | "wallet">("card");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number; receipt: string } | null>(null);

  if (!isAuth) {
    nav("/login");
    return null;
  }
  if (cart.items.length === 0 && !done) {
    return (
      <PageTransition>
        <section className="max-w-2xl mx-auto px-6 pt-20 pb-20 text-center">
          <h1 className="font-display font-extrabold text-3xl">Корзина пуста</h1>
          <button onClick={() => nav("/catalog")} className="btn-primary mt-6">В каталог</button>
        </section>
      </PageTransition>
    );
  }

  const canNext =
    (step === 0 && address.trim().length > 3) ||
    (step === 1 && !!time) ||
    (step === 2 && !!pay) ||
    step === 3;

  const submit = async () => {
    setSubmitting(true);
    try {
      const order = await ordersApi.checkout({
        address,
        delivery_time: time,
        payment_method: pay,
      });
      // Mock payment — always succeeds.
      const payment = await paymentsApi.pay(order.id, order.total);
      setDone({ id: order.id, total: order.total, receipt: payment.receipt });
      await refresh();
      toast.success("Заказ оформлен! 🎉");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Не удалось оформить заказ");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <PageTransition>
        <section className="max-w-2xl mx-auto px-6 pt-16 pb-20 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="text-8xl mb-4"
          >
            🎉
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display font-extrabold text-3xl sm:text-4xl"
          >
            Заказ оформлен!
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="card p-6 mt-8 text-left space-y-2"
          >
            <Row label="Номер заказа" value={done.id.slice(0, 8).toUpperCase()} />
            <Row label="Сумма" value={`${done.total.toLocaleString("ru-RU")} ₽`} />
            <Row label="Статус оплаты" value="Оплачено ✓" valueClass="text-green-600 font-bold" />
            <Row label="Чек" value={done.receipt} mono />
          </motion.div>
          <div className="flex gap-3 justify-center mt-7">
            <button onClick={() => nav("/profile")} className="btn-ghost">Мои заказы</button>
            <button onClick={() => nav("/")} className="btn-primary">На главную</button>
          </div>
        </section>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <h1 className="font-display font-extrabold text-3xl mb-6">Оформление заказа</h1>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <motion.div
                animate={{
                  scale: step === i ? 1.1 : 1,
                  backgroundColor: i <= step ? "#f97316" : "#fed7aa",
                }}
                className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center text-sm"
              >
                {i < step ? "✓" : i + 1}
              </motion.div>
              <div className="hidden sm:block text-sm font-semibold">{s}</div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-1 rounded ${i < step ? "bg-brand-400" : "bg-brand-100"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="card p-6"
          >
            {step === 0 && (
              <>
                <div className="font-display font-extrabold text-xl mb-4">Куда доставить?</div>
                <label className="label">Адрес доставки</label>
                <input
                  className="input"
                  placeholder="г. Москва, ул. Тверская, д. 1, кв. 100"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoFocus
                />
              </>
            )}
            {step === 1 && (
              <>
                <div className="font-display font-extrabold text-xl mb-4">Когда удобно?</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "Сегодня, 18:00–22:00",
                    "Завтра, 9:00–13:00",
                    "Завтра, 14:00–18:00",
                    "Послезавтра, 9:00–13:00",
                  ].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className={`px-4 py-3 rounded-xl text-left border-2 transition ${
                        time === t
                          ? "border-brand-500 bg-brand-50"
                          : "border-brand-100 hover:border-brand-300"
                      }`}
                    >
                      <div className="font-semibold">{t}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="font-display font-extrabold text-xl mb-4">Как оплатим?</div>
                <div className="space-y-2">
                  {([
                    ["card", "💳 Картой онлайн", "Оплата картой Visa / Mastercard / МИР"],
                    ["wallet", "📱 СБП / кошелёк", "Через приложение банка"],
                    ["cash", "💵 При получении", "Картой или наличными курьеру"],
                  ] as const).map(([k, label, hint]) => (
                    <button
                      key={k}
                      onClick={() => setPay(k)}
                      className={`w-full px-4 py-3 rounded-xl text-left border-2 transition ${
                        pay === k
                          ? "border-brand-500 bg-brand-50"
                          : "border-brand-100 hover:border-brand-300"
                      }`}
                    >
                      <div className="font-semibold">{label}</div>
                      <div className="text-sm text-ink/60">{hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-xs text-ink/50 italic">
                  ⚠️ Платежи в демо-режиме: оплата всегда успешна.
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="font-display font-extrabold text-xl mb-4">Проверьте заказ</div>
                <Row label="Адрес" value={address} />
                <Row label="Время" value={time} />
                <Row label="Оплата" value={{ card: "Картой онлайн", wallet: "СБП", cash: "При получении" }[pay]} />
                <Row label="Сумма" value={`${cart.total.toLocaleString("ru-RU")} ₽`} valueClass="font-display font-extrabold text-xl" />
                <div className="mt-6 space-y-2 max-h-60 overflow-y-auto">
                  {cart.items.map((it) => (
                    <div key={it.product_id} className="flex justify-between text-sm">
                      <span className="text-ink/70 line-clamp-1">{it.title} × {it.quantity}</span>
                      <span className="font-semibold">{it.subtotal.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => (step === 0 ? nav("/cart") : setStep(step - 1))}
            className="btn-ghost"
          >
            ← Назад
          </button>
          {step < STEPS.length - 1 ? (
            <button
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className="btn-primary"
            >
              Дальше →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} className="btn-primary">
              {submitting ? "Оформляем..." : "Подтвердить и оплатить"}
            </button>
          )}
        </div>
      </section>
    </PageTransition>
  );
}

function Row({ label, value, valueClass = "", mono = false }: { label: string; value: string; valueClass?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 gap-3">
      <span className="text-ink/60 text-sm shrink-0">{label}</span>
      <span className={`${valueClass} ${mono ? "font-mono text-sm" : ""} text-right`}>{value}</span>
    </div>
  );
}
