import { useState, useMemo } from "react";

type SortDir = "asc" | "desc";

export function useSortable<T>(items: T[], defaultField: keyof T) {
  const [sortField, setSortField] = useState<keyof T>(defaultField);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return sorted;
  }, [items, sortField, sortDir]);

  const totalPages = limit > 0 ? Math.max(1, Math.ceil(sorted.length / limit)) : 1;
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    if (limit <= 0) return sorted;
    const start = (safePage - 1) * limit;
    return sorted.slice(start, start + limit);
  }, [sorted, safePage, limit]);

  const toggleSort = (field: keyof T) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1); // Reset page on sort change
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset page on limit change
  };

  const nextPage = () => {
    setPage((p) => Math.min(p + 1, totalPages));
  };

  const prevPage = () => {
    setPage((p) => Math.max(p - 1, 1));
  };

  return {
    sorted: pageItems,
    sortField,
    sortDir,
    toggleSort,
    limit,
    setLimit: handleLimitChange,
    page: safePage,
    totalPages,
    totalItems: sorted.length,
    nextPage,
    prevPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

export function SortIcon(field: string, activeField: string, dir: SortDir): string {
  if (field !== activeField) return " ↕";
  return dir === "asc" ? " ↑" : " ↓";
}

export function LimitSelector({ limit, onChange }: { limit: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Tampilkan</span>
      <select
        value={limit}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
        <option value={200}>200</option>
        <option value={0}>Semua</option>
      </select>
      <span>baris</span>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [jumpInput, setJumpInput] = useState("");
  const [showJump, setShowJump] = useState(false);

  if (totalPages <= 1) return null;

  const handleJump = () => {
    const p = parseInt(jumpInput, 10);
    if (p >= 1 && p <= totalPages) {
      // Calculate how many pages to move
      const diff = p - page;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) onNext();
      } else {
        for (let i = 0; i < -diff; i++) onPrev();
      }
    }
    setJumpInput("");
    setShowJump(false);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-gray-400">
        Halaman {page} dari {totalPages} ({totalItems} total)
      </p>
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => {
            // Go to page 1 by calling prev repeatedly
            for (let i = 1; i < page; i++) onPrev();
          }}
          disabled={!hasPrev}
          className="px-2 py-1 text-xs font-medium rounded border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition text-gray-600"
          title="Halaman pertama"
        >
          ⟨⟨
        </button>
        {/* Previous */}
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition text-gray-600"
        >
          ← Sebelumnya
        </button>

        {/* Page jump input */}
        <div className="relative">
          {showJump ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJump()}
                onBlur={() => setTimeout(() => setShowJump(false), 200)}
                className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
                placeholder="..."
              />
              <button
                onClick={handleJump}
                className="px-1.5 py-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
              >
                Go
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowJump(true)}
              className="px-2 py-1 text-xs font-medium rounded border border-gray-200 hover:bg-gray-50 transition text-gray-500"
              title="Lompat ke halaman"
            >
              ...
            </button>
          )}
        </div>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition text-gray-600"
        >
          Selanjutnya →
        </button>
        {/* Last page */}
        <button
          onClick={() => {
            // Go to last page by calling next repeatedly
            for (let i = page; i < totalPages; i++) onNext();
          }}
          disabled={!hasNext}
          className="px-2 py-1 text-xs font-medium rounded border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition text-gray-600"
          title="Halaman terakhir"
        >
          ⟩⟩
        </button>
      </div>
    </div>
  );
}