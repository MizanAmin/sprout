import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

export interface QuickJumpItem {
  to: string;
  label: string;
}

// Command palette (Cmd/Ctrl-K) to jump between pages — mirrors the live app's
// quick-jump. Self-contained: owns its open state + keyboard shortcut.
export function QuickJump({ items }: { items: QuickJumpItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const results = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  const go = (to: string) => {
    setOpen(false);
    navigate({ to: to as never });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results[idx]) {
              go(results[idx].to);
            }
          }}
          placeholder="Jump to a page…"
          className="w-full border-b border-border bg-surface px-4 py-3 text-sm text-gray-900 outline-none"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No matches</div>
          ) : (
            results.map((i, n) => (
              <button
                key={i.to}
                onMouseEnter={() => setIdx(n)}
                onClick={() => go(i.to)}
                className={`flex w-full items-center px-4 py-2 text-left text-sm ${
                  n === idx ? 'bg-primary-light text-primary' : 'text-gray-700'
                }`}
              >
                {i.label}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
          ↑↓ navigate · ↵ open · esc close
        </div>
      </div>
    </div>
  );
}
