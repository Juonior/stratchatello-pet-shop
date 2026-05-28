import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { authApi } from "../api";
import { useAuth } from "../store";
import { PageTransition } from "../components/PageTransition";

export function Register() {
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль не короче 6 символов");
      return;
    }
    setLoading(true);
    try {
      const r = await authApi.register({ email, name, password });
      setSession(r.access_token, r.user);
      toast.success(`Привет, ${r.user.name}!`);
      nav("/");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Ошибка регистрации");
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
          <h1 className="font-display font-extrabold text-3xl">Регистрация</h1>
          <p className="text-ink/60 mt-1">Создайте аккаунт за минуту</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={submit}
          className="card p-6 space-y-4"
        >
          <div>
            <label className="label">Имя</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="text-xs text-ink/50 mt-1">Не короче 6 символов</div>
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Регистрируем..." : "Создать аккаунт"}
          </button>
          <div className="text-center text-sm text-ink/60">
            Уже есть аккаунт? <Link to="/login" className="text-brand-600 font-semibold hover:underline">Войти</Link>
          </div>
        </motion.form>
      </section>
    </PageTransition>
  );
}
