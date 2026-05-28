import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Catalog } from "./pages/Catalog";
import { ProductPage } from "./pages/Product";
import { CartPage } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Articles } from "./pages/Articles";
import { ArticlePage } from "./pages/Article";
import { Pets } from "./pages/Pets";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import { useAuth, useCart } from "./store";

export default function App() {
  const location = useLocation();
  const hydrate = useAuth((s) => s.hydrate);
  const isAuth = useAuth((s) => s.isAuth);
  const refreshCart = useCart((s) => s.refresh);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuth) refreshCart();
  }, [isAuth, refreshCart]);

  return (
    <div className="min-h-screen flex flex-col paw-bg">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/:slug" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/articles/:id" element={<ArticlePage />} />
            <Route path="/pets" element={<Pets />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
