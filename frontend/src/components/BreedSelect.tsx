import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DOG_BREEDS } from "../data/breeds";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}

export function BreedSelect({ value, onChange, placeholder = "Начните вводить — например, лабрадор", autoFocus, id }: Props) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOG_BREEDS.slice(0, 60);
    // substring match, breeds whose start matches go first
    const starts: string[] = [];
    const contains: string[] = [];
    for (const b of DOG_BREEDS) {
      const lower = b.toLowerCase();
      if (lower.startsWith(q)) starts.push(b);
      else if (lower.includes(q)) contains.push(b);
    }
    return [...starts, ...contains];
  }, [query]);

  useEffect(() => {
    setHover(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${hover}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hover, open]);

  const pick = (b: string) => {
    setQuery(b);
    onChange(b);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHover((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHover((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[hover]) pick(filtered[hover]);
      else if (query.trim()) {
        onChange(query.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          autoFocus={autoFocus}
          className="input pr-10"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink/40 hover:text-brand-600"
          aria-label="Раскрыть список"
        >
          <motion.svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: open ? 180 : 0 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-brand-200 rounded-xl shadow-soft max-h-72 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink/60">
                Не нашли в списке. Можно ввести свою породу — она сохранится как есть.
              </div>
            ) : (
              filtered.map((b, i) => (
                <button
                  type="button"
                  key={b}
                  data-idx={i}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => pick(b)}
                  className={`w-full text-left px-4 py-2 text-sm transition ${
                    i === hover ? "bg-brand-50 text-brand-700" : "text-ink/80"
                  }`}
                >
                  {highlight(b, query)}
                </button>
              ))
            )}
            {query.trim() && !filtered.some((b) => b.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => {
                  onChange(query.trim());
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm border-t border-brand-100 text-ink/70 hover:bg-brand-50"
              >
                Использовать «<span className="font-semibold text-ink">{query.trim()}</span>» как свою породу
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-brand-100 font-semibold rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}
