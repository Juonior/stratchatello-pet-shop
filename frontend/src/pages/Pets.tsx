import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { petsApi } from "../api";
import type { Pet, PetIn } from "../types";
import { useAuth } from "../store";
import { PageTransition } from "../components/PageTransition";
import { AvatarUploader } from "../components/AvatarUploader";
import { BreedSelect } from "../components/BreedSelect";

const EMPTY: PetIn = {
  name: "", breed: "", age: 1, weight: undefined, size: "medium",
  gender: "", allergies: "", favorite_treat: "", photo: null,
};


export function Pets() {
  const isAuth = useAuth((s) => s.isAuth);
  const nav = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [edit, setEdit] = useState<{ id?: string; data: PetIn } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth) {
      setLoading(false);
      return;
    }
    petsApi.list().then((p) => setPets(p)).finally(() => setLoading(false));
  }, [isAuth]);

  if (!isAuth) {
    return (
      <PageTransition>
        <section className="max-w-2xl mx-auto px-6 pt-20 pb-20 text-center">
          <h1 className="font-display font-extrabold text-3xl">Войдите в аккаунт</h1>
          <p className="text-ink/60 mt-2">Создание паспортов питомцев доступно зарегистрированным пользователям.</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => nav("/login")} className="btn-primary">Войти</button>
            <button onClick={() => nav("/register")} className="btn-ghost">Регистрация</button>
          </div>
        </section>
      </PageTransition>
    );
  }

  const save = async () => {
    if (!edit) return;
    if (!edit.data.name.trim() || !edit.data.breed.trim()) {
      toast.error("Кличка и порода обязательны");
      return;
    }
    try {
      if (edit.id) {
        const saved: Pet = await petsApi.update(edit.id, edit.data);
        setPets(pets.map((p) => (p.id === edit.id ? saved : p)));
        toast.success("Профиль обновлён");
      } else {
        const saved: Pet = await petsApi.create(edit.data);
        setPets([saved, ...pets]);
        toast.success("Питомец добавлен 🐶");
      }
      setEdit(null);
    } catch {
      toast.error("Не удалось сохранить");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить профиль питомца?")) return;
    await petsApi.remove(id);
    setPets(pets.filter((p) => p.id !== id));
    toast("Удалено", { icon: "🗑️" });
  };

  return (
    <PageTransition>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand-600">Личный кабинет</div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">Паспорта питомцев</h1>
            <p className="text-ink/60 mt-2">
              Добавьте собак — и получите персональные подборки на главной.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setEdit({ data: { ...EMPTY } })}
            className="btn-primary"
          >
            + Добавить питомца
          </motion.button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-56 skeleton" />)}
          </div>
        ) : pets.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="font-display font-extrabold text-2xl">Здесь пока пусто</div>
            <p className="text-ink/60 mt-2 max-w-sm mx-auto">Добавьте первого питомца — мы подберём для него корм и аксессуары на главной.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {pets.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  className="card overflow-hidden"
                >
                  <div className="h-36 bg-gradient-to-br from-brand-100 via-pink-100 to-sky-100 flex items-center justify-center overflow-hidden">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-white font-display font-bold text-3xl">
                        {p.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="font-display font-extrabold text-xl">{p.name}</div>
                    <div className="text-ink/60 text-sm mt-0.5">{p.breed} · {p.age} {plural(p.age)}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Pill>{labelSize(p.size)}</Pill>
                      {p.weight && <Pill>{p.weight} кг</Pill>}
                      {p.gender && <Pill>{p.gender === "male" ? "мальчик" : "девочка"}</Pill>}
                    </div>
                    {p.allergies && <div className="text-xs text-rose-600 mt-2">Аллергии: {p.allergies}</div>}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setEdit({ id: p.id, data: { ...p, weight: p.weight ?? undefined } })}
                        className="btn-ghost !py-2 text-sm flex-1"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="btn-ghost !py-2 !px-3 text-sm hover:!bg-rose-50 hover:!border-rose-200 hover:!text-rose-600"
                        aria-label="Удалить"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <AnimatePresence>
        {edit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEdit(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-display font-extrabold text-2xl">
                  {edit.id ? "Изменить" : "Новый питомец"}
                </h2>
                <button onClick={() => setEdit(null)} className="text-ink/40 hover:text-ink p-2">✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">Фото</label>
                  <AvatarUploader
                    kind="pet"
                    value={edit.data.photo}
                    onChange={(url) => setEdit({ ...edit, data: { ...edit.data, photo: url } })}
                    label="Загрузить фото"
                  />
                </div>
                <div>
                  <label className="label">Кличка *</label>
                  <input className="input" value={edit.data.name} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, name: e.target.value } })} />
                </div>
                <div>
                  <label className="label">Порода *</label>
                  <BreedSelect
                    value={edit.data.breed}
                    onChange={(b) => setEdit({ ...edit, data: { ...edit.data, breed: b } })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Возраст (лет)</label>
                    <input className="input" type="number" min="0" max="40" value={edit.data.age}
                      onChange={(e) => setEdit({ ...edit, data: { ...edit.data, age: +e.target.value } })} />
                  </div>
                  <div>
                    <label className="label">Вес (кг)</label>
                    <input className="input" type="number" step="0.1" min="0" max="200" value={edit.data.weight ?? ""}
                      onChange={(e) => setEdit({ ...edit, data: { ...edit.data, weight: e.target.value ? +e.target.value : undefined } })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Размер</label>
                    <select className="input" value={edit.data.size}
                      onChange={(e) => setEdit({ ...edit, data: { ...edit.data, size: e.target.value } })}>
                      <option value="small">Маленький</option>
                      <option value="medium">Средний</option>
                      <option value="large">Крупный</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Пол</label>
                    <select className="input" value={edit.data.gender || ""}
                      onChange={(e) => setEdit({ ...edit, data: { ...edit.data, gender: e.target.value } })}>
                      <option value="">—</option>
                      <option value="male">Мальчик</option>
                      <option value="female">Девочка</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Аллергии</label>
                  <input className="input" placeholder="Курица, лосось..." value={edit.data.allergies || ""}
                    onChange={(e) => setEdit({ ...edit, data: { ...edit.data, allergies: e.target.value } })} />
                </div>
                <div>
                  <label className="label">Любимое лакомство</label>
                  <input className="input" value={edit.data.favorite_treat || ""}
                    onChange={(e) => setEdit({ ...edit, data: { ...edit.data, favorite_treat: e.target.value } })} />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setEdit(null)} className="btn-ghost flex-1">Отмена</button>
                <button onClick={save} className="btn-primary flex-1">Сохранить</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <div className="bg-brand-50 text-ink/70 rounded-lg px-2.5 py-1.5 text-center">{children}</div>;
}
function labelSize(s?: string) {
  return s === "small" ? "Маленький" : s === "large" ? "Крупный" : "Средний";
}
function plural(n: number) {
  const m = n % 10, h = n % 100;
  if (m === 1 && h !== 11) return "год";
  if ([2, 3, 4].includes(m) && ![12, 13, 14].includes(h)) return "года";
  return "лет";
}
