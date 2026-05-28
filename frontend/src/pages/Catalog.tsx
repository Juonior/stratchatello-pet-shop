import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { catalogApi } from "../api";
import type { CatalogFilters } from "../api";
import type { Category, ProductCard as P } from "../types";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";
import { PageTransition } from "../components/PageTransition";

export function Catalog() {
  const { slug } = useParams();
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>({
    sort: "popular",
    category: slug,
  });

  useEffect(() => {
    Promise.all([catalogApi.categories(), catalogApi.brands()]).then(([c, b]) => {
      setCats(c);
      setBrands(b);
    });
  }, []);

  useEffect(() => {
    setFilters((f) => ({ ...f, category: slug }));
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    catalogApi.products(filters).then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, [filters]);

  const activeCat = useMemo(() => cats.find((c) => c.slug === slug), [cats, slug]);

  return (
    <PageTransition>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Hero banner with cover image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden mb-8 h-44 sm:h-56"
        >
          {activeCat?.cover_image ? (
            <img src={activeCat.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-100 via-pink-100 to-sky-100" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/40 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 sm:p-8 text-white">
            <div className="text-xs font-bold uppercase tracking-widest text-white/80">Каталог</div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">
              {activeCat ? activeCat.title : "Все товары"}
            </h1>
            {activeCat?.description && (
              <p className="text-white/80 mt-1.5 max-w-xl text-sm sm:text-base">{activeCat.description}</p>
            )}
          </div>
        </motion.div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-2 px-2">
          <ChipLink active={!slug} to="/catalog" label="Все товары" />
          {cats.map((c) => (
            <ChipLink key={c.id} active={c.slug === slug} to={`/catalog/${c.slug}`} label={c.title} />
          ))}
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 mt-6">
          {/* Filters */}
          <aside className="space-y-5">
            <FilterCard title="Поиск">
              <input
                className="input"
                placeholder="Название, бренд..."
                value={filters.q || ""}
                onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })}
              />
            </FilterCard>
            <FilterCard title="Цена">
              <div className="flex gap-2">
                <input
                  className="input"
                  type="number"
                  placeholder="От"
                  value={filters.min_price ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, min_price: e.target.value ? +e.target.value : undefined })
                  }
                />
                <input
                  className="input"
                  type="number"
                  placeholder="До"
                  value={filters.max_price ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, max_price: e.target.value ? +e.target.value : undefined })
                  }
                />
              </div>
            </FilterCard>
            <FilterCard title="Бренд">
              <select
                className="input"
                value={filters.brand || ""}
                onChange={(e) => setFilters({ ...filters, brand: e.target.value || undefined })}
              >
                <option value="">Все бренды</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </FilterCard>
            <FilterCard title="Рейтинг">
              <div className="flex flex-wrap gap-2">
                {[0, 3, 4, 4.5].map((r) => (
                  <button
                    key={r}
                    onClick={() =>
                      setFilters({ ...filters, min_rating: r === 0 ? undefined : r })
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      (filters.min_rating ?? 0) === r
                        ? "bg-brand-500 text-white border-brand-500"
                        : "border-brand-200 text-ink/70 hover:bg-brand-50"
                    }`}
                  >
                    {r === 0 ? "Любой" : `★ ${r}+`}
                  </button>
                ))}
              </div>
            </FilterCard>
            <button
              className="text-sm text-brand-600 hover:underline"
              onClick={() => setFilters({ sort: filters.sort, category: slug })}
            >
              Сбросить фильтры
            </button>
          </aside>

          {/* Grid */}
          <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
              <div className="text-sm text-ink/60">Найдено: {products.length}</div>
              <select
                className="input !w-auto !py-2"
                value={filters.sort || "popular"}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value as any })}
              >
                <option value="popular">По популярности</option>
                <option value="rating">По рейтингу</option>
                <option value="price_asc">Сначала дешёвые</option>
                <option value="price_desc">Сначала дорогие</option>
              </select>
            </div>

            {loading ? (
              <ProductGridSkeleton />
            ) : products.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="font-display font-extrabold text-xl">Ничего не нашли</div>
                <p className="text-ink/60 mt-1">Попробуйте изменить фильтры или сбросить их.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {products.map((p, i) => (
                  <ProductCard key={p.id} p={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function ChipLink({ to, label, active }: { to: string; label: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={`shrink-0 px-4 py-2 rounded-full font-semibold text-sm transition ${
        active
          ? "bg-brand-500 text-white shadow-soft"
          : "bg-white border border-brand-200 text-ink/70 hover:border-brand-300"
      }`}
    >
      {label}
    </Link>
  );
}
