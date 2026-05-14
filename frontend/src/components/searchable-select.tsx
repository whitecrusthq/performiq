import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { matchesPerson, type SearchablePerson } from "@/lib/search";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
  raw?: any;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  required,
  matcher,
  className,
  maxResults = 100,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  matcher?: (q: string, o: SearchableOption) => boolean;
  className?: string;
  maxResults?: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (selected && !open) setQuery("");
  }, [selected, open]);

  const defaultMatcher = (q: string, o: SearchableOption) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [o.label, o.description, o.badge].filter(Boolean)
      .some(t => (t as string).toLowerCase().includes(s));
  };
  const match = matcher ?? defaultMatcher;

  const q = query.trim();
  const matches = q
    ? options.filter(o => match(q, o)).slice(0, maxResults)
    : options.slice(0, maxResults);

  return (
    <div className={`relative ${className ?? ""}`} ref={wrapRef}>
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(""); }}
          className="w-full mt-1 px-3 py-2.5 rounded-xl border border-border bg-background text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{selected.label}</div>
            {selected.description && (
              <div className="text-xs text-muted-foreground truncate">{selected.description}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!required && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(true); setQuery(""); }}
                className="p-1 rounded hover:bg-muted"
                title="Clear"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
      ) : (
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
          />
          {open && (
            <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
              {matches.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">{emptyText}{q ? ` for "${q}"` : ""}.</div>
              ) : matches.map(o => (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 ${o.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{o.label}</div>
                      {o.description && (
                        <div className="text-xs text-muted-foreground truncate">{o.description}</div>
                      )}
                    </div>
                    {o.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{o.badge}</span>
                    )}
                  </div>
                </button>
              ))}
              {!q && options.length > maxResults && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground text-center border-t border-border">
                  Showing first {maxResults} — type to search all {options.length}.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function personMatcher(query: string, o: SearchableOption): boolean {
  return matchesPerson(query, o.raw as SearchablePerson, [o.label, o.description, o.badge]);
}
