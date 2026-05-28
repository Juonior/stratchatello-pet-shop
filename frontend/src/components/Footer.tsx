import { LogoFull } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-brand-100 bg-white/60">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <LogoFull size={32} />
          <p className="mt-3 text-ink/60 leading-relaxed">
            Зоомагазин для собак с персональными подборками и экспертными статьями.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">Поддержка</div>
          <ul className="space-y-1.5 text-ink/60">
            <li>пн–вс 9:00–22:00</li>
            <li>8 800 555 35 35</li>
            <li>support@hvostail.ru</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Доставка</div>
          <ul className="space-y-1.5 text-ink/60">
            <li>По Москве — за 2 часа</li>
            <li>По России — 1–3 дня</li>
            <li>Бесплатно от 2 990 ₽</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-100/60 py-4 text-center text-xs text-ink/50">
        © {new Date().getFullYear()} «Страчателла» · команда ИКБО-61-23 · РТУ МИРЭА
      </div>
    </footer>
  );
}
