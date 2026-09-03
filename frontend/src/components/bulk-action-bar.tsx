import { Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

interface BulkActionBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleting?: boolean;
  actions?: ReactNode;
}

export function BulkActionBar({ count, onDelete, onClear, deleting, actions }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 mb-4 rounded-xl bg-primary/10 border border-primary/20 text-sm font-medium">
      <div className="flex items-center gap-2">
        <span className="text-primary font-semibold">{count} selected</span>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-xs font-semibold disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? "Deleting…" : `Delete ${count}`}
        </button>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
