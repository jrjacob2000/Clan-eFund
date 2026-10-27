import React, { useEffect } from 'react';
import { AlertTriangle, Database, Trash2, X, Loader2 } from 'lucide-react';
import { ClanEFundDatabase, calculateTotals, formatPHP } from '../data/initialLedger';
import { FIRESTORE_DATABASE_ID } from '../services/firebaseDb';

interface DriveConfirmModalProps {
  isOpen: boolean;
  mode: 'overwrite_firestore_with_default' | 'delete_row';
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  db: ClanEFundDatabase;
  targetRowDescription?: string;
  targetRowDate?: string;
}

export const DriveConfirmModal: React.FC<DriveConfirmModalProps> = ({
  isOpen,
  mode,
  onClose,
  onConfirm,
  isSubmitting = false,
  db,
  targetRowDescription,
  targetRowDate
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totals = calculateTotals(db);
  const isDeleteRow = mode === 'delete_row';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-lg">
        {/* Mobile grab handle indicator */}
        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 truncate">
              {isDeleteRow
                ? 'Confirm Transaction Deletion'
                : 'Reset Firestore Database?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close confirmation modal"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-sm text-slate-600">
          {isDeleteRow ? (
            <p>
              Are you sure you want to permanently remove the ledger entry{' '}
              <strong className="text-slate-900">
                &ldquo;{targetRowDescription}&rdquo; ({targetRowDate})
              </strong>{' '}
              from your Clan E-Fund record?
            </p>
          ) : (
            <>
              <p>
                This action will reset your Firebase Firestore ledger and transactions to all{' '}
                <strong className="text-slate-900">{db.transactions.length} migrated spreadsheet records</strong>{' '}
                from January 2024 through October 2026, totaling{' '}
                <strong className="font-mono tabular-nums text-slate-900">{formatPHP(totals.totalFund)}</strong>.
              </p>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Database className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="truncate">Firestore DB: {FIRESTORE_DATABASE_ID}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block">Entries to Restore</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {db.transactions.length} rows
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Restored Total Fund</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700">
                      {formatPHP(totals.totalFund)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cash on Hand</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {formatPHP(totals.amountOnHand)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">BPI MMF + Short Term</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {formatPHP(totals.bpiMoneyMarket + totals.bpiShortTerm)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-75 whitespace-nowrap transition-all shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                <span>{isDeleteRow ? 'Deleting...' : 'Updating Firestore...'}</span>
              </>
            ) : (
              <>
                {isDeleteRow && <Trash2 className="h-3.5 w-3.5" />}
                <span>{isDeleteRow ? 'Delete Transaction' : 'Confirm Reset'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
