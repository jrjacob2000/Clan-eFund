import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  Search,
  Download,
  ArrowRight,
  X,
  Lock,
  Loader2,
  Pencil,
  Trash2,
  ArrowUpDown
} from 'lucide-react';
import {
  MamasSavingsState,
  MamasSavingsEntry,
  calculateMamasTotals,
  formatPHP
} from '../data/initialLedger';

interface MamasSavingsViewProps {
  state: MamasSavingsState;
  canManage: boolean;
  onUpdateState: (newState: MamasSavingsState) => void;
  isSyncing: boolean;
  userEmail?: string | null;
  onGoogleSignIn?: () => void;
  onReturnToClan?: () => void;
}

type MamasEntryType =
  | 'invest_deposit'
  | 'invest_withdrawal'
  | 'atm_deposit'
  | 'atm_withdrawal'
  | 'mhariz_repayment';

/**
 * Formats an ISO date string (YYYY-MM-DD) or Excel serial date into a friendly human date
 * like "Sep 30, 2026" so raw spreadsheet serial numbers (e.g., "45838.0") never appear.
 */
function formatFriendlyDate(isoDate?: string, fallbackDisplay?: string): {
  primary: string;
  weekday: string;
  monthYear: string;
  shortMonthYear: string;
  monthKey: string;
} {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) {
    const [y, m, d] = isoDate.trim().split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return {
        primary: dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        monthYear: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortMonthYear: dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: isoDate.trim().slice(0, 7)
      };
    }
  }

  // Fallback if an Excel serial number was passed
  const serialNum = Number(isoDate || fallbackDisplay);
  if (Number.isFinite(serialNum) && serialNum > 40000 && serialNum < 60000) {
    const utcDays = Math.floor(serialNum - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return {
      primary: dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      monthYear: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      shortMonthYear: dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthKey: `${y}-${m}`
    };
  }

  return {
    primary: fallbackDisplay || isoDate || '—',
    weekday: '',
    monthYear: 'Other',
    shortMonthYear: 'Other',
    monthKey: 'other'
  };
}

/**
 * Resolves a human-friendly description and category metadata for a Mama's Savings record,
 * even when migrated spreadsheet rows had empty notes.
 */
function resolveRecordPresentation(r: MamasSavingsEntry): {
  title: string;
  accountLabel: string;
  flowLabel: string;
  bucketType: 'invest' | 'atm' | 'loan';
  primaryAmount: number;
  isOutflow: boolean;
  isLoanTransfer: boolean;
} {
  const rawNote = (r.notes || '').trim();
  const isMharizLoan =
    r.invest === -40000 ||
    rawNote.toLowerCase().includes('mhariz') ||
    (r.date === '2026-08-04' && r.invest < 0);

  if (isMharizLoan && r.invest < 0) {
    return {
      title: rawNote || 'Hiram ni Mhariz (Personal Loan Outflow)',
      accountLabel: 'Invest Fund → Mhariz Receivable',
      flowLabel: 'Loan Outflow',
      bucketType: 'loan',
      primaryAmount: r.invest,
      isOutflow: true,
      isLoanTransfer: true
    };
  }

  if (r.invest > 0 && r.mamaAtm === 0) {
    return {
      title: rawNote || 'Monthly Allocation to Invest Fund',
      accountLabel: 'Invest Fund Reserve',
      flowLabel: 'Deposit',
      bucketType: 'invest',
      primaryAmount: r.invest,
      isOutflow: false,
      isLoanTransfer: false
    };
  }

  if (r.invest < 0 && r.mamaAtm === 0) {
    return {
      title: rawNote || 'Invest Fund Withdrawal / Disbursement',
      accountLabel: 'Invest Fund Reserve',
      flowLabel: 'Withdrawal',
      bucketType: 'invest',
      primaryAmount: r.invest,
      isOutflow: true,
      isLoanTransfer: false
    };
  }

  if (r.mamaAtm > 0 && r.invest === 0) {
    const isRepayment = rawNote.toLowerCase().includes('mhariz');
    return {
      title: rawNote || 'Monthly Deposit to Mama ATM',
      accountLabel: isRepayment ? 'Mhariz Loan → Mama ATM' : 'Mama ATM Account',
      flowLabel: isRepayment ? 'Loan Repayment' : 'Deposit',
      bucketType: isRepayment ? 'loan' : 'atm',
      primaryAmount: r.mamaAtm,
      isOutflow: false,
      isLoanTransfer: isRepayment
    };
  }

  if (r.mamaAtm < 0 && r.invest === 0) {
    return {
      title: rawNote || 'Mama ATM Cash Withdrawal',
      accountLabel: 'Mama ATM Account',
      flowLabel: 'Withdrawal',
      bucketType: 'atm',
      primaryAmount: r.mamaAtm,
      isOutflow: true,
      isLoanTransfer: false
    };
  }

  const combined = (r.invest || 0) + (r.mamaAtm || 0);
  return {
    title: rawNote || "Mama's Savings Entry",
    accountLabel:
      r.invest !== 0 && r.mamaAtm !== 0
        ? 'Invest Fund & Mama ATM'
        : r.invest !== 0
        ? 'Invest Fund Reserve'
        : 'Mama ATM Account',
    flowLabel: combined >= 0 ? 'Deposit' : 'Withdrawal',
    bucketType: r.invest !== 0 ? 'invest' : 'atm',
    primaryAmount: combined,
    isOutflow: combined < 0,
    isLoanTransfer: false
  };
}

export const MamasSavingsView: React.FC<MamasSavingsViewProps> = ({
  state,
  canManage,
  onUpdateState,
  isSyncing,
  userEmail,
  onGoogleSignIn,
  onReturnToClan
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'invest' | 'atm' | 'outflows'>('all');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest_desc' | 'oldest_asc'>('newest_desc');

  // Entry Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MamasSavingsEntry | null>(null);
  const [entryType, setEntryType] = useState<MamasEntryType>('invest_deposit');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = useState('5000');
  const [entryNotes, setEntryNotes] = useState('');
  const [isModalSaving, setIsModalSaving] = useState(false);

  // Delete confirmation state
  const [deletingRecord, setDeletingRecord] = useState<MamasSavingsEntry | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute chronological running balances for every record
  const recordsWithRunningBalances = useMemo(() => {
    const sortedChronological = [...state.records].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.rowRef || 0) - (b.rowRef || 0);
    });

    let runningInvest = 0;
    let runningAtm = 0;

    return sortedChronological.map((rec, index) => {
      runningInvest = Number((runningInvest + (rec.invest || 0)).toFixed(2));
      runningAtm = Number((runningAtm + (rec.mamaAtm || 0)).toFixed(2));
      const runningLiquid = Number((runningInvest + runningAtm).toFixed(2));
      const netDelta = Number(((rec.invest || 0) + (rec.mamaAtm || 0)).toFixed(2));

      return {
        ...rec,
        chronologicalIndex: index + 1,
        runningInvest,
        runningAtm,
        runningLiquid,
        netDelta,
        formattedDate: formatFriendlyDate(rec.date, rec.displayDate),
        presentation: resolveRecordPresentation(rec)
      };
    });
  }, [state.records]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of state.records) {
      if (r.date && r.date.length >= 4) {
        years.add(r.date.slice(0, 4));
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [state.records]);

  const filteredRecords = useMemo(() => {
    const matches = recordsWithRunningBalances.filter((r) => {
      if (filterType === 'invest' && r.invest === 0) return false;
      if (filterType === 'atm' && r.mamaAtm === 0) return false;
      if (filterType === 'outflows' && r.netDelta >= 0) return false;
      if (yearFilter !== 'ALL' && !r.date.startsWith(`${yearFilter}-`)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.presentation.title.toLowerCase().includes(q);
        const matchAccount = r.presentation.accountLabel.toLowerCase().includes(q);
        const matchDate =
          r.formattedDate.primary.toLowerCase().includes(q) ||
          r.formattedDate.monthYear.toLowerCase().includes(q) ||
          r.date.includes(q);
        const matchAmt =
          String(Math.abs(r.invest)).includes(q) || String(Math.abs(r.mamaAtm)).includes(q);
        return matchTitle || matchAccount || matchDate || matchAmt;
      }
      return true;
    });

    if (sortOrder === 'newest_desc') {
      return [...matches].reverse();
    }
    return matches;
  }, [recordsWithRunningBalances, filterType, yearFilter, searchQuery, sortOrder]);

  const filteredStats = useMemo(() => {
    let investIn = 0;
    let investOut = 0;
    let atmIn = 0;
    let atmOut = 0;

    for (const r of filteredRecords) {
      if (r.invest > 0) investIn += r.invest;
      if (r.invest < 0) investOut += Math.abs(r.invest);
      if (r.mamaAtm > 0) atmIn += r.mamaAtm;
      if (r.mamaAtm < 0) atmOut += Math.abs(r.mamaAtm);
    }

    return {
      investIn,
      investOut,
      atmIn,
      atmOut,
      netInvest: investIn - investOut,
      netAtm: atmIn - atmOut
    };
  }, [filteredRecords]);

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-6 max-w-xl mx-auto shadow-xs my-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <Lock className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            Mama&apos;s Personal Savings is Private
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            This personal account is strictly managed by Jonathan (
            <span className="font-mono font-semibold text-slate-800">jrjacob2000@gmail.com</span>)
            for Mama. View-only contributors and non-managers do not have access to view balances
            or transactions in this account.
          </p>
          {userEmail && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md py-1.5 px-3 font-mono inline-block">
              Signed in as: {userEmail} (Unauthorized)
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onGoogleSignIn && !userEmail && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full sm:w-auto rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              Sign In with Google
            </button>
          )}
          {onReturnToClan && (
            <button
              type="button"
              onClick={onReturnToClan}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Return to Clan Emergency Fund
            </button>
          )}
        </div>
      </div>
    );
  }

  const openNewModal = (type: MamasEntryType) => {
    setEditingRecord(null);
    setEntryType(type);
    setEntryDate(todayStr);
    if (type === 'invest_deposit') {
      setEntryAmount('5000');
      setEntryNotes('Monthly allocation to Invest Fund');
    } else if (type === 'invest_withdrawal') {
      setEntryAmount('5000');
      setEntryNotes('Invest Fund withdrawal / disbursement');
    } else if (type === 'atm_deposit') {
      setEntryAmount('5000');
      setEntryNotes('Monthly deposit to Mama ATM');
    } else if (type === 'atm_withdrawal') {
      setEntryAmount('2000');
      setEntryNotes("ATM cash withdrawal for Mama's needs");
    } else if (type === 'mhariz_repayment') {
      setEntryAmount('5000');
      setEntryNotes('Loan payment collected from Mhariz into Mama ATM');
    }
    setIsModalOpen(true);
  };

  const openEditModal = (rec: MamasSavingsEntry) => {
    setEditingRecord(rec);
    setEntryDate(rec.date || todayStr);
    const presentation = resolveRecordPresentation(rec);
    setEntryNotes(rec.notes || presentation.title);

    if (rec.invest > 0) {
      setEntryType('invest_deposit');
      setEntryAmount(String(Math.abs(rec.invest)));
    } else if (rec.invest < 0) {
      setEntryType('invest_withdrawal');
      setEntryAmount(String(Math.abs(rec.invest)));
    } else if (rec.mamaAtm > 0) {
      const isMhariz = (rec.notes || '').toLowerCase().includes('mhariz');
      setEntryType(isMhariz ? 'mhariz_repayment' : 'atm_deposit');
      setEntryAmount(String(Math.abs(rec.mamaAtm)));
    } else {
      setEntryType('atm_withdrawal');
      setEntryAmount(String(Math.abs(rec.mamaAtm)));
    }
    setIsModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Math.abs(parseFloat(entryAmount) || 0);
    if (numAmt === 0) return;

    setIsModalSaving(true);

    try {
      let investDelta = 0;
      let atmDelta = 0;
      let loanDelta = 0;

      if (entryType === 'invest_deposit') {
        investDelta = numAmt;
      } else if (entryType === 'invest_withdrawal') {
        investDelta = -numAmt;
      } else if (entryType === 'atm_deposit') {
        atmDelta = numAmt;
      } else if (entryType === 'atm_withdrawal') {
        atmDelta = -numAmt;
      } else if (entryType === 'mhariz_repayment') {
        atmDelta = numAmt;
        loanDelta = -numAmt;
      }

      const friendly = formatFriendlyDate(entryDate);

      if (editingRecord) {
        const updatedRecords = state.records.map((r) => {
          const isMatch =
            (editingRecord.id && r.id === editingRecord.id) ||
            (!editingRecord.id && r.rowRef === editingRecord.rowRef && r.date === editingRecord.date);
          if (!isMatch) return r;
          return {
            ...r,
            date: entryDate,
            displayDate: friendly.primary,
            invest: investDelta,
            mamaAtm: atmDelta,
            notes: entryNotes.trim()
          };
        });

        const updatedState = calculateMamasTotals({
          ...state,
          records: updatedRecords
        });

        await onUpdateState(updatedState);
      } else {
        const nextRowRef =
          state.records.length > 0
            ? Math.max(...state.records.map((r) => r.rowRef || 0)) + 1
            : 1;

        const newRecord: MamasSavingsEntry = {
          id: `mamas-rec-${Date.now()}`,
          rowRef: nextRowRef,
          date: entryDate,
          displayDate: friendly.primary,
          invest: investDelta,
          mamaAtm: atmDelta,
          notes: entryNotes.trim()
        };

        const updatedState = calculateMamasTotals({
          ...state,
          loanToMhariz: Math.max(0, state.loanToMhariz + loanDelta),
          records: [...state.records, newRecord]
        });

        await onUpdateState(updatedState);
      }

      setIsModalOpen(false);
      setEditingRecord(null);
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    const updatedRecords = state.records.filter((r) => {
      if (deletingRecord.id && r.id) return r.id !== deletingRecord.id;
      return !(r.rowRef === deletingRecord.rowRef && r.date === deletingRecord.date);
    });

    const updatedState = calculateMamasTotals({
      ...state,
      records: updatedRecords
    });

    setDeletingRecord(null);
    await onUpdateState(updatedState);
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Particulars',
      'Account Bucket',
      'Invest Fund (PHP)',
      'Mama ATM (PHP)',
      'Running Liquid Balance (PHP)'
    ];
    const rows = recordsWithRunningBalances.map((r) => [
      `"${r.formattedDate.primary}"`,
      `"${r.presentation.title.replace(/"/g, '""')}"`,
      `"${r.presentation.accountLabel}"`,
      r.invest.toFixed(2),
      r.mamaAtm.toFixed(2),
      r.runningLiquid.toFixed(2)
    ]);

    rows.push([
      '"TOTALS"',
      '"Cumulative Subtotals"',
      '""',
      state.investBalance.toFixed(2),
      state.mamaAtmBalance.toFixed(2),
      `"Hiram ni Mhariz: ${state.loanToMhariz.toFixed(2)} | Total Savings: ${state.totalSavings.toFixed(2)}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `mamas-personal-savings-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const investPct = state.totalSavings > 0 ? (state.investBalance / state.totalSavings) * 100 : 0;
  const atmPct = state.totalSavings > 0 ? (state.mamaAtmBalance / state.totalSavings) * 100 : 0;
  const loanPct = state.totalSavings > 0 ? (state.loanToMhariz / state.totalSavings) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-200 text-purple-800 shrink-0">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-purple-950">
              Mama&apos;s Personal Savings Account
            </div>
            <div className="text-purple-700 mt-0.5">
              Private personal ledger managed by Jonathan · Completely independent from the Clan Emergency Fund
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-purple-700 shrink-0">
          <span>{state.records.length} recorded transactions</span>
          {isSyncing && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-purple-800">Syncing to Firestore...</span>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Pillars */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-purple-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">Total Personal Savings</span>
            <span className="text-xs font-mono text-purple-500">All 3 Buckets</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-purple-950">
            {formatPHP(state.totalSavings)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Liquid: {formatPHP(state.investBalance + state.mamaAtmBalance)} · Receivable:{' '}
            {formatPHP(state.loanToMhariz)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Invest Fund Reserve</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {investPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPHP(state.investBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Capital growth &amp; long-term reserve
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Mama ATM Account</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {atmPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatPHP(state.mamaAtmBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Accessible cash buffer on Mama&apos;s ATM
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              Hiram ni Mhariz (Receivable)
            </span>
            <span className="text-xs font-mono tabular-nums text-amber-700">
              {loanPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-900">
            {formatPHP(state.loanToMhariz)}
          </div>
          <div className="mt-1.5 text-xs text-amber-700">
            Personal loan collectible from Mhariz
          </div>
        </div>
      </div>

      {/* Allocation Bar & Quick Entry Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            Mama&apos;s Asset Distribution
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
            <span>Invest Fund: {investPct.toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span>Mama ATM: {atmPct.toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span>Hiram ni Mhariz: {loanPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            style={{ width: `${Math.max(0, Math.min(100, investPct))}%` }}
            className="bg-purple-700 transition-all"
            title={`Invest Fund: ${formatPHP(state.investBalance)}`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, atmPct))}%` }}
            className="bg-emerald-600 transition-all"
            title={`Mama ATM: ${formatPHP(state.mamaAtmBalance)}`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, loanPct))}%` }}
            className="bg-amber-500 transition-all"
            title={`Hiram ni Mhariz: ${formatPHP(state.loanToMhariz)}`}
          />
        </div>

        {canManage && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Quick Record Entry:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openNewModal('invest_deposit')}
                className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 transition-colors whitespace-nowrap shrink-0"
              >
                + Deposit to Invest Fund
              </button>
              <button
                type="button"
                onClick={() => openNewModal('atm_deposit')}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                + Deposit to Mama ATM
              </button>
              <button
                type="button"
                onClick={() => openNewModal('mhariz_repayment')}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
              >
                + Collect Mhariz Payment
              </button>
              <button
                type="button"
                onClick={() => openNewModal('atm_withdrawal')}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
              >
                - ATM Withdrawal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Fintech Activity Ledger (No Row Numbers, No Raw Serials, No Sparse Empty Columns) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        {/* Toolbar: Title, Search, Filters, Sort, Export */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Mama&apos;s Savings Activity Stream
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredRecords.length} of {state.records.length} transactions ·{' '}
                {sortOrder === 'newest_desc' ? 'Newest first' : 'Chronological (Oldest first)'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative w-full sm:w-52">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search month, note, or amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-300 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              {/* Account Bucket Segmented Filter */}
              <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterType === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('invest')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterType === 'invest'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Invest Fund
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('atm')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterType === 'atm'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mama ATM
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('outflows')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterType === 'outflows'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Withdrawals
                </button>
              </div>

              {/* Year Filter */}
              <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setYearFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    yearFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Years
                </button>
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setYearFilter(yr)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                      yearFilter === yr
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              {/* Sort Toggle */}
              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) => (prev === 'newest_desc' ? 'oldest_asc' : 'newest_desc'))
                }
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                title="Switch sort order between Newest First and Oldest First"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                <span>{sortOrder === 'newest_desc' ? 'Newest' : 'Oldest'}</span>
              </button>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Filtered Summary Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              <span>
                Invest Inflows:{' '}
                <strong className="text-purple-900">+{formatPHP(filteredStats.investIn)}</strong>
              </span>
              {filteredStats.investOut > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Invest Outflows:{' '}
                    <strong className="text-red-600">-{formatPHP(filteredStats.investOut)}</strong>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                ATM Deposits:{' '}
                <strong className="text-emerald-700">+{formatPHP(filteredStats.atmIn)}</strong>
              </span>
              {filteredStats.atmOut > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    ATM Withdrawals:{' '}
                    <strong className="text-red-600">-{formatPHP(filteredStats.atmOut)}</strong>
                  </span>
                </>
              )}
            </div>
            {(filterType !== 'all' ||
              yearFilter !== 'ALL' ||
              searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setYearFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Clean Column Headers (Desktop) */}
        <div className="hidden md:grid md:grid-cols-12 items-center border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold text-slate-500">
          <div className="col-span-2">Date</div>
          <div className="col-span-4">Transaction &amp; Particulars</div>
          <div className="col-span-3">Account Bucket &amp; Running Balance</div>
          <div className="col-span-2 text-right">Amount &amp; Total Liquid</div>
          {canManage && <div className="col-span-1 text-right">Manage</div>}
        </div>

        {/* Unified Activity Stream Rows */}
        {filteredRecords.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500">
            No transactions match your current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredRecords.map((r) => {
                  const amt = r.presentation.primaryAmount;
                  const isNegative = amt < 0;

                  return (
                    <div
                      key={r.id || `${r.rowRef}-${r.date}`}
                      className="px-5 py-3.5 hover:bg-purple-50/20 transition-colors"
                    >
                      {/* Mobile View */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {r.presentation.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-700">
                                {r.formattedDate.primary}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  r.presentation.isLoanTransfer
                                    ? 'text-amber-700 font-medium'
                                    : r.invest !== 0
                                    ? 'text-purple-700 font-medium'
                                    : 'text-emerald-700 font-medium'
                                }
                              >
                                {r.presentation.accountLabel}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div
                              className={`text-sm font-bold font-mono tabular-nums ${
                                isNegative
                                  ? 'text-red-600'
                                  : r.invest !== 0
                                  ? 'text-purple-900'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {amt > 0 ? `+${formatPHP(amt)}` : formatPHP(amt)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400">
                              Liquid Bal: {formatPHP(r.runningLiquid)}
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center justify-end gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(r)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRecord(r)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Desktop 12-Col Unified Row */}
                      <div className="hidden md:grid md:grid-cols-12 items-center gap-4 text-xs">
                        {/* Col 1-2: Human Date */}
                        <div className="col-span-2 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {r.formattedDate.primary}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {r.formattedDate.weekday}
                          </div>
                        </div>

                        {/* Col 3-6: Transaction & Particulars */}
                        <div className="col-span-4 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {r.presentation.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {r.presentation.flowLabel}
                          </div>
                        </div>

                        {/* Col 7-9: Account Bucket & Bucket Running Balance */}
                        <div className="col-span-3">
                          <div
                            className={`font-medium ${
                              r.presentation.isLoanTransfer
                                ? 'text-amber-800'
                                : r.invest !== 0
                                ? 'text-purple-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            {r.presentation.accountLabel}
                          </div>
                          <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                            {r.invest !== 0
                              ? `Invest Bal: ${formatPHP(r.runningInvest)}`
                              : `ATM Bal: ${formatPHP(r.runningAtm)}`}
                          </div>
                        </div>

                        {/* Col 10-11: Unified Amount & Total Liquid Balance */}
                        <div className="col-span-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`text-sm font-bold ${
                              isNegative
                                ? 'text-red-600'
                                : r.invest !== 0
                                ? 'text-purple-900'
                                : 'text-emerald-700'
                            }`}
                          >
                            {amt > 0 ? `+${formatPHP(amt)}` : formatPHP(amt)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Liquid: {formatPHP(r.runningLiquid)}
                          </div>
                        </div>

                        {/* Col 12: Actions */}
                        {canManage && (
                          <div className="col-span-1 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(r)}
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                title="Edit record"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRecord(r)}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
            })}
          </div>
        )}

        {/* Summary Footer */}
        <div className="bg-purple-50/80 px-5 py-4 border-t border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-purple-950">Current Ending Balances</div>
            <div className="text-[11px] text-purple-700 mt-0.5">
              Includes Invest Fund, Mama ATM, and Hiram ni Mhariz Receivable
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-purple-700 block">Invest Fund</span>
              <span className="font-bold text-purple-950">{formatPHP(state.investBalance)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 block">Mama ATM</span>
              <span className="font-bold text-emerald-800">{formatPHP(state.mamaAtmBalance)}</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-800 block">Mhariz Loan</span>
              <span className="font-bold text-amber-900">{formatPHP(state.loanToMhariz)}</span>
            </div>
            <div className="pl-3 border-l border-purple-200">
              <span className="text-[10px] text-purple-800 block">Total Savings</span>
              <span className="font-bold text-sm text-purple-950">
                {formatPHP(state.totalSavings)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRecord(null);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Savings Entry?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  This will remove the entry on{' '}
                  <span className="font-semibold text-slate-900">
                    {formatFriendlyDate(deletingRecord.date, deletingRecord.displayDate).primary}
                  </span>{' '}
                  and recalculate Mama&apos;s balances.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-md bg-slate-50 p-3 text-xs space-y-1 border border-slate-200">
              <div className="font-semibold text-slate-800">
                {resolveRecordPresentation(deletingRecord).title}
              </div>
              <div className="font-mono tabular-nums text-slate-600">
                {deletingRecord.invest !== 0 && `Invest: ${formatPHP(deletingRecord.invest)} `}
                {deletingRecord.mamaAtm !== 0 && `Mama ATM: ${formatPHP(deletingRecord.mamaAtm)}`}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Modal for Mama's Savings */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
              setEditingRecord(null);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-purple-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-100 bg-purple-50/60 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-purple-950">
                  {editingRecord
                    ? "Edit Mama's Savings Entry"
                    : "Record Entry for Mama's Savings"}
                </h3>
                <p className="text-xs text-purple-700">
                  Managed strictly within Mama&apos;s personal account
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRecord(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Type
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as MamasEntryType)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                >
                  <option value="invest_deposit">+ Deposit to Invest Fund</option>
                  <option value="invest_withdrawal">- Withdrawal from Invest Fund</option>
                  <option value="atm_deposit">+ Deposit to Mama ATM</option>
                  <option value="atm_withdrawal">- Cash Withdrawal from Mama ATM</option>
                  <option value="mhariz_repayment">
                    + Collect Mhariz Loan Payment (to Mama ATM)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (PHP)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  required
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm font-mono tabular-nums text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Particulars / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g., Monthly allocation to Invest Fund..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRecord(null);
                  }}
                  disabled={isModalSaving}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isModalSaving}
                  className="rounded-md bg-purple-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-80 flex items-center gap-1.5 shadow-xs transition-all"
                >
                  {isModalSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-300" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>{editingRecord ? 'Update Record' : 'Save Record'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
