import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  Plus,
  Search,
  Download,
  AlertCircle,
  ArrowRight,
  X,
  CreditCard,
  TrendingUp,
  HandCoins,
  ShieldAlert,
  Lock,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { MamasSavingsState, MamasSavingsEntry, calculateMamasTotals, formatPHP } from '../data/initialLedger';

interface MamasSavingsViewProps {
  state: MamasSavingsState;
  canManage: boolean;
  onUpdateState: (newState: MamasSavingsState) => void;
  isSyncing: boolean;
  userEmail?: string | null;
  onGoogleSignIn?: () => void;
  onReturnToClan?: () => void;
}

type MamasEntryType = 'invest_deposit' | 'atm_deposit' | 'atm_withdrawal' | 'mhariz_repayment';

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
  const [filterType, setFilterType] = useState<'all' | 'invest' | 'atm'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<MamasEntryType>('invest_deposit');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = useState('5000');
  const [entryNotes, setEntryNotes] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
            This personal account is strictly managed by Jonathan (<span className="font-mono font-semibold text-slate-800">jrjacob2000@gmail.com</span>) for Mama. View-only contributors and non-managers do not have access to view balances or transactions in this account.
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

  const openModal = (type: MamasEntryType) => {
    setEntryType(type);
    setEntryDate(todayStr);
    if (type === 'invest_deposit') {
      setEntryAmount('5000');
      setEntryNotes("Regular allocation to Mama's Invest Fund");
    } else if (type === 'atm_deposit') {
      setEntryAmount('5000');
      setEntryNotes("Deposit into Mama's ATM Account");
    } else if (type === 'atm_withdrawal') {
      setEntryAmount('2000');
      setEntryNotes("ATM cash withdrawal for Mama's personal needs");
    } else if (type === 'mhariz_repayment') {
      setEntryAmount('5000');
      setEntryNotes("Loan payment collected from Mhariz into Mama ATM");
    }
    setIsModalOpen(true);
  };

  const [isModalSaving, setIsModalSaving] = useState(false);

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
      } else if (entryType === 'atm_deposit') {
        atmDelta = numAmt;
      } else if (entryType === 'atm_withdrawal') {
        atmDelta = -numAmt;
      } else if (entryType === 'mhariz_repayment') {
        atmDelta = numAmt;
        loanDelta = -numAmt;
      }

      const nextRowRef = state.records.length > 0
        ? Math.max(...state.records.map((r) => r.rowRef || 0)) + 1
        : 1;

      const parts = entryDate.split('-');
      const displayDate = parts.length === 3
        ? `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`
        : entryDate;

      const newRecord: MamasSavingsEntry = {
        id: `mamas-rec-${Date.now()}`,
        rowRef: nextRowRef,
        date: entryDate,
        displayDate,
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
      setIsModalOpen(false);
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Row', 'Date', 'Display Date', 'Invest Fund (PHP)', 'Mama ATM (PHP)', 'Notes'];
    const rows = state.records.map((r) => [
      r.rowRef,
      `"${r.date}"`,
      `"${r.displayDate}"`,
      r.invest.toFixed(2),
      r.mamaAtm.toFixed(2),
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    rows.push([
      'TOTALS',
      '',
      '',
      state.investBalance.toFixed(2),
      state.mamaAtmBalance.toFixed(2),
      `"Hiram ni Mhariz: ${state.loanToMhariz.toFixed(2)} | Total Savings: ${state.totalSavings.toFixed(2)}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mamas-personal-savings-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = useMemo(() => {
    return state.records.filter((r) => {
      if (filterType === 'invest' && r.invest === 0) return false;
      if (filterType === 'atm' && r.mamaAtm === 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        const matchDate = r.displayDate.includes(q) || r.date.includes(q);
        return matchNotes || matchDate;
      }
      return true;
    });
  }, [state.records, filterType, searchQuery]);

  const investPct = state.totalSavings > 0 ? (state.investBalance / state.totalSavings) * 100 : 0;
  const atmPct = state.totalSavings > 0 ? (state.mamaAtmBalance / state.totalSavings) * 100 : 0;
  const loanPct = state.totalSavings > 0 ? (state.loanToMhariz / state.totalSavings) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Decoupling Notice Banner */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-200 text-purple-800 shrink-0">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-purple-950">
              Mama&apos;s Personal Savings Account
            </div>
            <div className="text-purple-700 mt-0.5">
              Strictly separate personal savings managed by Jonathan for Mama · Not connected to the Clan Emergency Fund
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-purple-800 border border-purple-200 shadow-2xs">
            Workbook Sheet 2 Migrated
          </span>
          {isSyncing && (
            <span className="text-[11px] font-medium text-purple-600 animate-pulse">
              Syncing...
            </span>
          )}
        </div>
      </div>

      {/* 4 Pillars of Mama's Personal Savings */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Personal Savings */}
        <div className="rounded-lg border border-purple-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">Total Personal Savings</span>
            <span className="text-xs font-mono text-purple-400">All 3 Buckets</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-purple-950">
            {formatPHP(state.totalSavings)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-700/80">
            <span>Invest + ATM + Mhariz Loan</span>
          </div>
        </div>

        {/* Invest Fund Balance */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Invest Fund Reserve</span>
            <span className="text-xs font-mono text-slate-400">{investPct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPHP(state.investBalance)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Capital growth &amp; investment</span>
          </div>
        </div>

        {/* Mama ATM Balance */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Mama ATM Account</span>
            <span className="text-xs font-mono text-slate-400">{atmPct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatPHP(state.mamaAtmBalance)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Liquid cash buffer on ATM card</span>
          </div>
        </div>

        {/* Hiram ni Mhariz (Receivable) */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Hiram ni Mhariz (Receivable)</span>
            <span className="text-xs font-mono text-amber-600">{loanPct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-900">
            {formatPHP(state.loanToMhariz)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
            <span>Personal loan collectible from Mhariz</span>
          </div>
        </div>
      </div>

      {/* Allocation Bar & Admin Quick Triggers */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            Mama&apos;s Asset Distribution
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-700" />
              <span>Invest Fund: {investPct.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>Mama ATM: {atmPct.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Hiram ni Mhariz: {loanPct.toFixed(1)}%</span>
            </span>
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
            <span className="text-xs font-semibold text-slate-500">Admin Actions for Mama:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openModal('invest_deposit')}
                className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 transition-colors"
              >
                + Deposit to Invest Fund
              </button>
              <button
                type="button"
                onClick={() => openModal('atm_deposit')}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                + Deposit to Mama ATM
              </button>
              <button
                type="button"
                onClick={() => openModal('mhariz_repayment')}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
              >
                + Collect Mhariz Payment
              </button>
              <button
                type="button"
                onClick={() => openModal('atm_withdrawal')}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                - ATM Cash Outflow
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Records Table Header & Filters */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Mama&apos;s Transaction History ({state.records.length} records)
            </h3>
            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
              Sheet 2
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notes or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('invest')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'invest' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                }`}
              >
                Invest
              </button>
              <button
                type="button"
                onClick={() => setFilterType('atm')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'atm' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                }`}
              >
                ATM
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Mobile Card List View (Visible on mobile screens) */}
        <div className="divide-y divide-slate-100 sm:hidden">
          {filteredRecords.map((r) => (
            <div key={r.id || r.rowRef} className="p-3.5 space-y-2 hover:bg-purple-50/30 transition-colors">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    R{r.rowRef}
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">{r.displayDate}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-xs">
                  {r.invest !== 0 && (
                    <span className={r.invest < 0 ? 'text-red-600 font-bold' : 'text-purple-900 font-bold'}>
                      Invest: {formatPHP(r.invest)}
                    </span>
                  )}
                  {r.mamaAtm !== 0 && (
                    <span className={r.mamaAtm < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                      ATM: {formatPHP(r.mamaAtm)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                {r.notes || <span className="text-slate-400 italic">Mama savings allocation</span>}
              </p>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No records found matching your search.
            </div>
          )}

          {/* Mobile Subtotals Summary Card */}
          <div className="bg-purple-50/90 p-4 border-t border-purple-200 text-xs space-y-1">
            <div className="font-bold text-purple-950 flex items-center justify-between">
              <span>Cumulative Subtotals</span>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                Sheet 2
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono tabular-nums">
              <div>
                <span className="text-slate-500 text-[10px] block">Invest Fund</span>
                <span className="font-bold text-purple-900">{formatPHP(state.investBalance)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Mama ATM</span>
                <span className="font-bold text-emerald-800">{formatPHP(state.mamaAtmBalance)}</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-purple-200/60 text-purple-900 font-medium">
              + Hiram ni Mhariz: <span className="font-mono font-bold">{formatPHP(state.loanToMhariz)}</span>
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Table View (Visible on sm+ screens) */}
        <div className="hidden sm:block w-full min-w-0 max-w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600">
                <th className="px-4 py-2.5">Row</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 text-right">Invest Fund</th>
                <th className="px-4 py-2.5 text-right">Mama ATM</th>
                <th className="px-4 py-2.5">Notes &amp; Particulars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <tr key={r.id || r.rowRef} className="hover:bg-purple-50/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-slate-400">
                    R{r.rowRef}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">
                    {r.displayDate}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {r.invest !== 0 ? (
                      <span className={r.invest < 0 ? 'text-red-600 font-semibold' : 'text-purple-900 font-semibold'}>
                        {formatPHP(r.invest)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {r.mamaAtm !== 0 ? (
                      <span className={r.mamaAtm < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                        {formatPHP(r.mamaAtm)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.notes || (
                      <span className="text-slate-400 italic">Mama savings allocation</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No records found matching your search.
                  </td>
                </tr>
              )}

              {/* Totals Row */}
              <tr className="bg-purple-50/80 font-bold border-t border-purple-200">
                <td colSpan={2} className="px-4 py-3 text-purple-950 font-sans">
                  Cumulative Subtotals
                </td>
                <td className="px-4 py-3 text-right text-purple-950 font-mono tabular-nums">
                  {formatPHP(state.investBalance)}
                </td>
                <td className="px-4 py-3 text-right text-purple-950 font-mono tabular-nums">
                  {formatPHP(state.mamaAtmBalance)}
                </td>
                <td className="px-4 py-3 text-purple-950">
                  + Hiram ni Mhariz: <span className="font-mono">{formatPHP(state.loanToMhariz)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Entry Modal for Mama's Savings */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-purple-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-100 bg-purple-50/60 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-purple-950">
                  Record Entry for Mama&apos;s Savings
                </h3>
                <p className="text-xs text-purple-700">
                  Managed strictly within Mama&apos;s personal account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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
                  <option value="atm_deposit">+ Deposit to Mama ATM</option>
                  <option value="atm_withdrawal">- Cash Withdrawal from Mama ATM</option>
                  <option value="mhariz_repayment">+ Collect Mhariz Loan Payment (to Mama ATM)</option>
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
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional particulars or reference..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Record</span>
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
