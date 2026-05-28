import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, useCart } from "../store";
import { LogoFull } from "./Logo";

const links = [
  { to: "/", label: "Главная" },
  { to: "/catalog", label: "Каталог" },
  { to: "/feed", label: "Лента", auth: true },
  { to: "/users", label: "Друзья", auth: true },
  { to: "/messages", label: "Сообщения", auth: true },
  { to: "/articles", label: "Статьи" },
  { to: "/pets", label: "Питомцы" },
];

export function Navbar() {
  const { user, isAuth, logout } = useAuth();
  const count = useCart((s) => s.cart.count);
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 backdrop-blur-lg bg-cream/80 border-b border-brand-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-6">
        <Link to="/" className="shrink-0">
          <LogoFull size={36} />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.filter((l) => !l.auth || isAuth).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `relative px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? "text-brand-700 bg-brand-100"
                    : "text-ink/70 hover:text-brand-600 hover:bg-brand-50"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/cart")}
            className="relative btn-ghost !px-3 !py-2"
            aria-label="Корзина"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.7 5h13.4M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
            <span className="hidden sm:inline text-sm">Корзина</span>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-brand-500 text-white text-[11px] min-w-[20px] h-5 rounded-full px-1 flex items-center justify-center font-bold"
              >
                {count}
              </motion.span>
            )}
          </motion.button>

          {isAuth ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/profile")}
                className="btn-ghost !px-3 !py-2 text-sm"
                title={user?.email}
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                  {user?.photo ? (
                    <img src={user.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]?.toUpperCase() || "?"
                  )}
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate">{user?.name}</span>
              </button>
              <button onClick={logout} className="text-xs text-ink/50 hover:text-brand-600 px-2">
                Выйти
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-ghost !px-3 !py-2 text-sm hidden sm:flex">
                Войти
              </Link>
              <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="md:hidden border-t border-brand-100 px-2 py-2 overflow-x-auto">
        <nav className="flex gap-1 w-max">
          {links.filter((l) => !l.auth || isAuth).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  isActive ? "bg-brand-100 text-brand-700" : "text-ink/70"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
