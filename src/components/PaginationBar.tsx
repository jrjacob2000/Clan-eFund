import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  accent?: 'slate' | 'purple';
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'records',
  accent = 'slate'
}) => {
  if (totalItems <= 0) return null;

  const effectivePageSize = pageSize <= 0 ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIdx = (safeCurrentPage - 1) * effectivePageSize + 1;
  const endIdx = Math.min(totalItems, safeCurrentPage * effectivePageSize);

  // Build visible page numbers window (up to 5 page buttons)
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxButtons = 5;
    let startPage = Math.max(1, safeCurrentPage - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const activeBtnClass =
    accent === 'purple'
      ? 'border-purple-900 bg-purple-900 text-white font-bold shadow-2xs'
      : 'border-slate-900 bg-slate-900 text-white font-bold shadow-2xs';

  const inactiveBtnClass =
    accent === 'purple'
      ? 'border-purple-200 bg-white text-purple-900 hover:bg-purple-50'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 sm:px-5 border-t text-xs ${
        accent === 'purple'
          ? 'border-purple-100 bg-white text-purple-900'
          : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      {/* Left: Showing X-Y of Z + Rows per page */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
        <div className="font-mono tabular-nums">
          Showing{' '}
          <strong className={accent === 'purple' ? 'text-purple-950' : 'text-slate-900'}>
            {startIdx}–{endIdx}
          </strong>{' '}
          of{' '}
          <strong className={accent === 'purple' ? 'text-purple-950' : 'text-slate-900'}>
            {totalItems}
          </strong>{' '}
          {itemLabel}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <label className="text-slate-500 whitespace-nowrap">Rows:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                onPageSizeChange(nextSize);
                onPageChange(1);
              }}
              className={`rounded border px-2 py-1 text-xs font-mono font-semibold focus:outline-hidden ${
                accent === 'purple'
                  ? 'border-purple-200 bg-purple-50/50 text-purple-950 focus:border-purple-600'
                  : 'border-slate-300 bg-slate-50 text-slate-800 focus:border-slate-900'
              }`}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>
        )}
      </div>

      {/* Right: Page navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center sm:justify-end gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage === 1}
            className={`p-1.5 rounded border transition-colors disabled:opacity-40 disabled:pointer-events-none ${inactiveBtnClass}`}
            title="First page"
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1}
            className={`px-2 py-1 rounded border transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none ${inactiveBtnClass}`}
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          <div className="flex items-center gap-1 mx-0.5">
            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[28px] h-7 px-2 rounded border font-mono text-xs transition-colors ${
                  pageNum === safeCurrentPage ? activeBtnClass : inactiveBtnClass
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage === totalPages}
            className={`px-2 py-1 rounded border transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none ${inactiveBtnClass}`}
            title="Next page"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage === totalPages}
            className={`p-1.5 rounded border transition-colors disabled:opacity-40 disabled:pointer-events-none ${inactiveBtnClass}`}
            title="Last page"
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
