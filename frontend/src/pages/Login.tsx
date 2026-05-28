import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { authApi } from "../api";
import { useAuth } from "../store";
import { PageTransition } from "../components/PageTransition";

export function Login() {
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await authApi.login({ email, password });
      setSession(r.access_token, r.user);
      toast.success(`С возвращением, ${r.user.name}!`);
      nav("/");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <section className="max-w-md mx-auto px-4 pt-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-display font-extrabold text-3xl">Вход</h1>
          <p className="text-ink/60 mt-1">Рады видеть вас снова</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={submit}
          className="card p-6 space-y-4"
        >
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
          <div className="text-center text-sm text-ink/60">
            Нет аккаунта? <Link to="/register" className="text-brand-600 font-semibold hover:underline">Зарегистрироваться</Link>
          </div>
        </motion.form>
      </section>
    </PageTransition>
  );
}
