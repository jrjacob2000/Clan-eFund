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
  ArrowUpDown,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import {
  DEFAULT_MAMAS_BUCKET_LABELS,
  MamasBucketCategory,
  MamasBucketLabels,
  MamasCustomBucket,
  MamasSavingsState,
  MamasSavingsEntry,
  calculateMamasTotals,
  formatPHP
} from '../data/initialLedger';
import {
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets,
  sanitizeCsvCell
} from '../services/firebaseDb';
import { PaginationBar } from './PaginationBar';

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
  | 'mhariz_repayment'
  | string;

function getLocalIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
function resolveRecordPresentation(
  r: MamasSavingsEntry,
  labels: MamasBucketLabels = DEFAULT_MAMAS_BUCKET_LABELS,
  customBuckets: MamasCustomBucket[] = []
): {
  title: string;
  accountLabel: string;
  flowLabel: string;
  bucketType: 'invest' | 'atm' | 'loan' | 'custom';
  customBucket?: MamasCustomBucket;
  primaryAmount: number;
  isOutflow: boolean;
  isLoanTransfer: boolean;
} {
  const { investLabel, atmLabel, loanLabel } = labels;
  const rawNote = (r.notes || '')
    .trim()
    .replace(/Invest Fund Reserve/gi, investLabel)
    .replace(/Invest Fund/gi, investLabel)
    .replace(/BPI Short Term/gi, investLabel);

  if (r.customBucketId) {
    const foundCustom = customBuckets.find((b) => b.id === r.customBucketId);
    const customLabel = foundCustom?.label || 'Custom Bucket';
    const amt = Number(r.customAmount) || 0;
    return {
      title:
        rawNote ||
        (amt >= 0 ? `Allocation to ${customLabel}` : `${customLabel} Withdrawal`),
      accountLabel: customLabel,
      flowLabel: amt >= 0 ? 'Deposit' : 'Withdrawal',
      bucketType: 'custom',
      customBucket: foundCustom,
      primaryAmount: amt,
      isOutflow: amt < 0,
      isLoanTransfer: foundCustom?.category === 'receivable'
    };
  }

  const isMharizLoan =
    r.invest === -40000 ||
    rawNote.toLowerCase().includes('mhariz') ||
    rawNote.toLowerCase().includes(loanLabel.toLowerCase()) ||
    (r.date === '2026-08-04' && r.invest < 0);

  if (isMharizLoan && r.invest < 0) {
    return {
      title: rawNote || `${loanLabel} (Loan from ${investLabel})`,
      accountLabel: `${investLabel} → ${loanLabel}`,
      flowLabel: 'Loan Outflow',
      bucketType: 'loan',
      primaryAmount: r.invest,
      isOutflow: true,
      isLoanTransfer: true
    };
  }

  if (r.invest > 0 && r.mamaAtm === 0) {
    return {
      title: rawNote || `Monthly Allocation to ${investLabel}`,
      accountLabel: investLabel,
      flowLabel: 'Deposit',
      bucketType: 'invest',
      primaryAmount: r.invest,
      isOutflow: false,
      isLoanTransfer: false
    };
  }

  if (r.invest < 0 && r.mamaAtm === 0) {
    return {
      title: rawNote || `${investLabel} Withdrawal / Disbursement`,
      accountLabel: investLabel,
      flowLabel: 'Withdrawal',
      bucketType: 'invest',
      primaryAmount: r.invest,
      isOutflow: true,
      isLoanTransfer: false
    };
  }

  if (r.mamaAtm > 0 && r.invest === 0) {
    const isRepayment =
      rawNote.toLowerCase().includes('mhariz') ||
      rawNote.toLowerCase().includes(loanLabel.toLowerCase());
    return {
      title: rawNote || `Monthly Deposit to ${atmLabel}`,
      accountLabel: isRepayment ? `${loanLabel} → ${atmLabel}` : atmLabel,
      flowLabel: isRepayment ? 'Loan Repayment' : 'Deposit',
      bucketType: isRepayment ? 'loan' : 'atm',
      primaryAmount: r.mamaAtm,
      isOutflow: false,
      isLoanTransfer: isRepayment
    };
  }

  if (r.mamaAtm < 0 && r.invest === 0) {
    return {
      title: rawNote || `${atmLabel} Cash Withdrawal`,
      accountLabel: atmLabel,
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
        ? `${investLabel} & ${atmLabel}`
        : r.invest !== 0
        ? investLabel
        : atmLabel,
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
  const [filterType, setFilterType] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest_desc' | 'oldest_asc'>('newest_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Entry Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MamasSavingsEntry | null>(null);
  const [entryType, setEntryType] = useState<MamasEntryType>('invest_deposit');
  const [entryDate, setEntryDate] = useState(() => getLocalIsoDate());
  const [entryAmount, setEntryAmount] = useState('5000');
  const [entryNotes, setEntryNotes] = useState('');
  const [isModalSaving, setIsModalSaving] = useState(false);

  // Delete confirmation state
  const [deletingRecord, setDeletingRecord] = useState<MamasSavingsEntry | null>(null);

  // Configurable Bucket Labels & Custom Buckets (Reference Data) Modal State
  const bucketLabels = useMemo(
    () => normalizeMamasBucketLabels(state.bucketLabels),
    [state.bucketLabels]
  );
  const customBuckets = useMemo(
    () => normalizeMamasCustomBuckets(state.customBuckets),
    [state.customBuckets]
  );
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [draftInvestLabel, setDraftInvestLabel] = useState(bucketLabels.investLabel);
  const [draftAtmLabel, setDraftAtmLabel] = useState(bucketLabels.atmLabel);
  const [draftLoanLabel, setDraftLoanLabel] = useState(bucketLabels.loanLabel);
  const [draftCustomBuckets, setDraftCustomBuckets] = useState<MamasCustomBucket[]>(customBuckets);
  const [newBucketLabel, setNewBucketLabel] = useState('');
  const [newBucketCategory, setNewBucketCategory] = useState<MamasBucketCategory>('investment');
  const [newBucketDescription, setNewBucketDescription] = useState('');
  const [isBucketSaving, setIsBucketSaving] = useState(false);

  const todayStr = useMemo(() => getLocalIsoDate(), []);

  // Compute chronological running balances for every record (including custom buckets)
  const recordsWithRunningBalances = useMemo(() => {
    const sortedChronological = [...state.records].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.rowRef || 0) - (b.rowRef || 0);
    });

    let runningInvest = 0;
    let runningAtm = 0;
    const runningCustomMap: Record<string, number> = {};

    return sortedChronological.map((rec, index) => {
      runningInvest = Number((runningInvest + (rec.invest || 0)).toFixed(2));
      runningAtm = Number((runningAtm + (rec.mamaAtm || 0)).toFixed(2));
      if (rec.customBucketId) {
        const prev = runningCustomMap[rec.customBucketId] || 0;
        runningCustomMap[rec.customBucketId] = Number(
          (prev + (rec.customAmount || 0)).toFixed(2)
        );
      }

      let customLiquidSum = 0;
      for (const cb of customBuckets) {
        if (cb.category !== 'receivable') {
          customLiquidSum += runningCustomMap[cb.id] || 0;
        }
      }

      const runningLiquid = Number(
        (runningInvest + runningAtm + customLiquidSum).toFixed(2)
      );
      const netDelta = Number(
        (
          (rec.invest || 0) +
          (rec.mamaAtm || 0) +
          (rec.customBucketId ? rec.customAmount || 0 : 0)
        ).toFixed(2)
      );

      return {
        ...rec,
        chronologicalIndex: index + 1,
        runningInvest,
        runningAtm,
        runningCustomBalances: { ...runningCustomMap },
        runningLiquid,
        netDelta,
        formattedDate: formatFriendlyDate(rec.date, rec.displayDate),
        presentation: resolveRecordPresentation(rec, bucketLabels, customBuckets)
      };
    });
  }, [state.records, bucketLabels, customBuckets]);

  const customBucketsWithBalances = useMemo(() => {
    return customBuckets.map((cb) => {
      const balance = Number(
        state.records
          .filter((r) => r.customBucketId === cb.id)
          .reduce((sum, r) => sum + (Number(r.customAmount) || 0), 0)
          .toFixed(2)
      );
      const pct = state.totalSavings > 0 ? (balance / state.totalSavings) * 100 : 0;
      const recordCount = state.records.filter((r) => r.customBucketId === cb.id).length;
      return {
        ...cb,
        balance,
        pct,
        recordCount
      };
    });
  }, [customBuckets, state.records, state.totalSavings]);

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
      if (filterType.startsWith('custom:')) {
        const targetBucketId = filterType.slice('custom:'.length);
        if (r.customBucketId !== targetBucketId) return false;
      }
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
          String(Math.abs(r.invest)).includes(q) ||
          String(Math.abs(r.mamaAtm)).includes(q) ||
          String(Math.abs(r.customAmount || 0)).includes(q);
        return matchTitle || matchAccount || matchDate || matchAmt;
      }
      return true;
    });

    if (sortOrder === 'newest_desc') {
      return [...matches].reverse();
    }
    return matches;
  }, [recordsWithRunningBalances, filterType, yearFilter, searchQuery, sortOrder]);

  // Reset pagination to page 1 when filters/search/sort change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, yearFilter, searchQuery, sortOrder]);

  const paginatedRecords = useMemo(() => {
    if (pageSize <= 0) return filteredRecords;
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const filteredStats = useMemo(() => {
    let investIn = 0;
    let investOut = 0;
    let atmIn = 0;
    let atmOut = 0;
    let customIn = 0;
    let customOut = 0;

    for (const r of filteredRecords) {
      if (r.invest > 0) investIn += r.invest;
      if (r.invest < 0) investOut += Math.abs(r.invest);
      if (r.mamaAtm > 0) atmIn += r.mamaAtm;
      if (r.mamaAtm < 0) atmOut += Math.abs(r.mamaAtm);
      if (r.customBucketId) {
        const cAmt = Number(r.customAmount) || 0;
        if (cAmt > 0) customIn += cAmt;
        if (cAmt < 0) customOut += Math.abs(cAmt);
      }
    }

    return {
      investIn,
      investOut,
      atmIn,
      atmOut,
      customIn,
      customOut,
      netInvest: investIn - investOut,
      netAtm: atmIn - atmOut,
      netCustom: customIn - customOut
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

  const openBucketConfigModal = () => {
    setDraftInvestLabel(bucketLabels.investLabel);
    setDraftAtmLabel(bucketLabels.atmLabel);
    setDraftLoanLabel(bucketLabels.loanLabel);
    setDraftCustomBuckets(customBuckets);
    setNewBucketLabel('');
    setNewBucketCategory('investment');
    setNewBucketDescription('');
    setIsBucketModalOpen(true);
  };

  const handleAddDraftCustomBucket = () => {
    const trimmed = newBucketLabel.trim();
    if (!trimmed) return;
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const id = `bucket-${slug || 'custom'}-${Date.now().toString(36)}`;
    const nextBucket: MamasCustomBucket = {
      id,
      label: trimmed,
      category: newBucketCategory,
      ...(newBucketDescription.trim() ? { description: newBucketDescription.trim() } : {})
    };
    setDraftCustomBuckets((prev) => [...prev, nextBucket]);
    setNewBucketLabel('');
    setNewBucketDescription('');
  };

  const handleRemoveDraftCustomBucket = (bucketId: string) => {
    setDraftCustomBuckets((prev) => prev.filter((b) => b.id !== bucketId));
  };

  const handleUpdateDraftCustomBucket = (
    bucketId: string,
    patch: Partial<MamasCustomBucket>
  ) => {
    setDraftCustomBuckets((prev) =>
      prev.map((b) => (b.id === bucketId ? { ...b, ...patch } : b))
    );
  };

  const handleSaveBucketLabels = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLabels = normalizeMamasBucketLabels({
      investLabel: draftInvestLabel,
      atmLabel: draftAtmLabel,
      loanLabel: draftLoanLabel
    });

    // If the user typed a new bucket name in the quick input but didn't click "+ Add", include it automatically
    let finalCustomBuckets = [...draftCustomBuckets];
    if (newBucketLabel.trim()) {
      const trimmed = newBucketLabel.trim();
      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      finalCustomBuckets.push({
        id: `bucket-${slug || 'custom'}-${Date.now().toString(36)}`,
        label: trimmed,
        category: newBucketCategory,
        ...(newBucketDescription.trim() ? { description: newBucketDescription.trim() } : {})
      });
    }
    const normalizedCustom = normalizeMamasCustomBuckets(finalCustomBuckets);

    setIsBucketSaving(true);
    try {
      const oldInvest = bucketLabels.investLabel;
      const oldAtm = bucketLabels.atmLabel;
      const oldLoan = bucketLabels.loanLabel;

      const updatedRecords = state.records.map((r) => {
        let nextNote = (r.notes || '').trim();
        if (oldInvest && oldInvest !== newLabels.investLabel) {
          nextNote = nextNote.split(oldInvest).join(newLabels.investLabel);
        }
        if (oldAtm && oldAtm !== newLabels.atmLabel) {
          nextNote = nextNote.split(oldAtm).join(newLabels.atmLabel);
        }
        if (oldLoan && oldLoan !== newLabels.loanLabel) {
          nextNote = nextNote.split(oldLoan).join(newLabels.loanLabel);
        }
        nextNote = nextNote
          .replace(/Invest Fund Reserve/gi, newLabels.investLabel)
          .replace(/Invest Fund/gi, newLabels.investLabel);
        return {
          ...r,
          notes: nextNote
        };
      });

      const updatedState = calculateMamasTotals({
        ...state,
        bucketLabels: newLabels,
        customBuckets: normalizedCustom,
        records: updatedRecords
      });

      await onUpdateState(updatedState);
      setNewBucketLabel('');
      setNewBucketDescription('');
      setIsBucketModalOpen(false);
    } finally {
      setIsBucketSaving(false);
    }
  };

  const applyDefaultNotesForEntryType = (type: MamasEntryType) => {
    if (type === 'invest_deposit') {
      setEntryAmount('5000');
      setEntryNotes(`Monthly allocation to ${bucketLabels.investLabel}`);
    } else if (type === 'invest_withdrawal') {
      setEntryAmount('5000');
      setEntryNotes(`${bucketLabels.investLabel} withdrawal / disbursement`);
    } else if (type === 'atm_deposit') {
      setEntryAmount('5000');
      setEntryNotes(`Monthly deposit to ${bucketLabels.atmLabel}`);
    } else if (type === 'atm_withdrawal') {
      setEntryAmount('2000');
      setEntryNotes(`${bucketLabels.atmLabel} cash withdrawal for Mama's needs`);
    } else if (type === 'mhariz_repayment') {
      setEntryAmount('5000');
      setEntryNotes(
        `Loan payment collected for ${bucketLabels.loanLabel} into ${bucketLabels.atmLabel}`
      );
    } else if (type.startsWith('custom_deposit:')) {
      const bucketId = type.slice('custom_deposit:'.length);
      const cb = customBuckets.find((b) => b.id === bucketId);
      setEntryAmount('5000');
      setEntryNotes(`Allocation / deposit to ${cb?.label || 'Custom Bucket'}`);
    } else if (type.startsWith('custom_withdrawal:')) {
      const bucketId = type.slice('custom_withdrawal:'.length);
      const cb = customBuckets.find((b) => b.id === bucketId);
      setEntryAmount('2000');
      setEntryNotes(`Withdrawal from ${cb?.label || 'Custom Bucket'}`);
    }
  };

  const openNewModal = (type: MamasEntryType) => {
    setEditingRecord(null);
    setEntryType(type);
    setEntryDate(todayStr);
    applyDefaultNotesForEntryType(type);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: MamasSavingsEntry) => {
    setEditingRecord(rec);
    setEntryDate(rec.date || todayStr);
    const presentation = resolveRecordPresentation(rec, bucketLabels, customBuckets);
    setEntryNotes(rec.notes || presentation.title);

    if (rec.customBucketId) {
      const amt = Number(rec.customAmount) || 0;
      setEntryType(
        amt >= 0
          ? `custom_deposit:${rec.customBucketId}`
          : `custom_withdrawal:${rec.customBucketId}`
      );
      setEntryAmount(String(Math.abs(amt)));
    } else if (rec.invest > 0) {
      setEntryType('invest_deposit');
      setEntryAmount(String(Math.abs(rec.invest)));
    } else if (rec.invest < 0) {
      setEntryType('invest_withdrawal');
      setEntryAmount(String(Math.abs(rec.invest)));
    } else if (rec.mamaAtm > 0) {
      const noteLower = (rec.notes || '').toLowerCase();
      const isLoanRepayment =
        noteLower.includes('mhariz') ||
        noteLower.includes(bucketLabels.loanLabel.toLowerCase());
      setEntryType(isLoanRepayment ? 'mhariz_repayment' : 'atm_deposit');
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
      let customBucketId: string | undefined = undefined;
      let customAmount: number | undefined = undefined;

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
      } else if (entryType.startsWith('custom_deposit:')) {
        customBucketId = entryType.slice('custom_deposit:'.length);
        customAmount = numAmt;
      } else if (entryType.startsWith('custom_withdrawal:')) {
        customBucketId = entryType.slice('custom_withdrawal:'.length);
        customAmount = -numAmt;
      }

      let finalNotes = entryNotes.trim();
      if (entryType === 'mhariz_repayment') {
        const lower = finalNotes.toLowerCase();
        if (
          !lower.includes('mhariz') &&
          !lower.includes(bucketLabels.loanLabel.toLowerCase())
        ) {
          finalNotes = finalNotes
            ? `${finalNotes} (${bucketLabels.loanLabel} repayment)`
            : `Loan payment collected for ${bucketLabels.loanLabel} into ${bucketLabels.atmLabel}`;
        }
      }

      const friendly = formatFriendlyDate(entryDate);

      if (editingRecord) {
        const updatedRecords = state.records.map((r) => {
          const isMatch =
            (editingRecord.id && r.id === editingRecord.id) ||
            (!editingRecord.id && r.rowRef === editingRecord.rowRef && r.date === editingRecord.date);
          if (!isMatch) return r;
          const nextRec: MamasSavingsEntry = {
            ...r,
            date: entryDate,
            displayDate: friendly.primary,
            invest: investDelta,
            mamaAtm: atmDelta,
            notes: finalNotes
          };
          if (customBucketId) {
            nextRec.customBucketId = customBucketId;
            nextRec.customAmount = customAmount || 0;
          } else {
            delete nextRec.customBucketId;
            delete nextRec.customAmount;
          }
          return nextRec;
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
          ...(customBucketId
            ? { customBucketId, customAmount: customAmount || 0 }
            : {}),
          notes: finalNotes
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
      `${bucketLabels.investLabel} (PHP)`,
      `${bucketLabels.atmLabel} (PHP)`,
      ...customBuckets.map((cb) => `${cb.label} (PHP)`),
      'Running Liquid Balance (PHP)'
    ].map((h) => sanitizeCsvCell(h));
    const rows = recordsWithRunningBalances.map((r) => [
      sanitizeCsvCell(r.formattedDate.primary),
      sanitizeCsvCell(r.presentation.title),
      sanitizeCsvCell(r.presentation.accountLabel),
      r.invest.toFixed(2),
      r.mamaAtm.toFixed(2),
      ...customBuckets.map((cb) =>
        r.customBucketId === cb.id ? (r.customAmount || 0).toFixed(2) : '0.00'
      ),
      r.runningLiquid.toFixed(2)
    ]);

    rows.push([
      '"TOTALS"',
      '"Cumulative Subtotals"',
      '""',
      state.investBalance.toFixed(2),
      state.mamaAtmBalance.toFixed(2),
      ...customBucketsWithBalances.map((cb) => cb.balance.toFixed(2)),
      sanitizeCsvCell(
        `${bucketLabels.loanLabel}: ${state.loanToMhariz.toFixed(2)} | Total Savings: ${state.totalSavings.toFixed(2)}`
      )
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mamas-personal-savings-${getLocalIsoDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const investPct = state.totalSavings > 0 ? (state.investBalance / state.totalSavings) * 100 : 0;
  const atmPct = state.totalSavings > 0 ? (state.mamaAtmBalance / state.totalSavings) * 100 : 0;
  const loanPct = state.totalSavings > 0 ? (state.loanToMhariz / state.totalSavings) * 100 : 0;
  const totalBucketCount = 3 + customBucketsWithBalances.length;
  const customLiquidTotal = customBucketsWithBalances
    .filter((cb) => cb.category !== 'receivable')
    .reduce((s, cb) => s + cb.balance, 0);
  const customReceivableTotal = customBucketsWithBalances
    .filter((cb) => cb.category === 'receivable')
    .reduce((s, cb) => s + cb.balance, 0);

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
        <div className="flex flex-wrap items-center gap-3 text-xs text-purple-700 shrink-0">
          <span>{state.records.length} recorded transactions</span>
          {isSyncing && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-purple-800">Syncing to Firestore...</span>
            </>
          )}
          {canManage && (
            <button
              type="button"
              onClick={openBucketConfigModal}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-100/60 transition-colors shadow-2xs"
              title="Configure account bucket names (saved as reference data in Firestore)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-purple-700" />
              <span>Configure Buckets</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Pillars (Core + Any Custom Buckets) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-purple-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">Total Personal Savings</span>
            <span className="text-xs font-mono text-purple-500">
              All {totalBucketCount} Buckets
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-purple-950">
            {formatPHP(state.totalSavings)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Liquid: {formatPHP(state.investBalance + state.mamaAtmBalance + customLiquidTotal)} ·
            Receivable: {formatPHP(state.loanToMhariz + customReceivableTotal)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{bucketLabels.investLabel}</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {investPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPHP(state.investBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Capital growth &amp; {bucketLabels.investLabel} investment
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{bucketLabels.atmLabel}</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {atmPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatPHP(state.mamaAtmBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Accessible cash buffer on {bucketLabels.atmLabel}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              {bucketLabels.loanLabel} (Receivable)
            </span>
            <span className="text-xs font-mono tabular-nums text-amber-700">
              {loanPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-900">
            {formatPHP(state.loanToMhariz)}
          </div>
          <div className="mt-1.5 text-xs text-amber-700">
            Personal loan receivable ({bucketLabels.loanLabel})
          </div>
        </div>

        {customBucketsWithBalances.map((cb) => {
          const isReceivable = cb.category === 'receivable';
          const isInvest = cb.category === 'investment';
          return (
            <div
              key={cb.id}
              className={`rounded-lg border p-5 shadow-xs ${
                isReceivable
                  ? 'border-amber-200 bg-amber-50/40'
                  : isInvest
                  ? 'border-indigo-200 bg-indigo-50/30'
                  : 'border-teal-200 bg-teal-50/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold truncate ${
                    isReceivable
                      ? 'text-amber-800'
                      : isInvest
                      ? 'text-indigo-800'
                      : 'text-teal-800'
                  }`}
                >
                  {cb.label}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {cb.pct.toFixed(1)}%
                </span>
              </div>
              <div
                className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                  isReceivable
                    ? 'text-amber-900'
                    : isInvest
                    ? 'text-indigo-950'
                    : 'text-teal-800'
                }`}
              >
                {formatPHP(cb.balance)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 truncate">
                {cb.description ||
                  (isReceivable
                    ? 'Custom receivable bucket'
                    : isInvest
                    ? 'Custom investment fund bucket'
                    : 'Custom liquid savings bucket')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Allocation Bar & Quick Entry Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            Mama&apos;s Asset Distribution
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
            <span>
              {bucketLabels.investLabel}: {investPct.toFixed(1)}%
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {bucketLabels.atmLabel}: {atmPct.toFixed(1)}%
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {bucketLabels.loanLabel}: {loanPct.toFixed(1)}%
            </span>
            {customBucketsWithBalances.map((cb) => (
              <React.Fragment key={cb.id}>
                <span aria-hidden="true">·</span>
                <span>
                  {cb.label}: {cb.pct.toFixed(1)}%
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            style={{ width: `${Math.max(0, Math.min(100, investPct))}%` }}
            className="bg-purple-700 transition-all"
            title={`${bucketLabels.investLabel}: ${formatPHP(state.investBalance)}`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, atmPct))}%` }}
            className="bg-emerald-600 transition-all"
            title={`${bucketLabels.atmLabel}: ${formatPHP(state.mamaAtmBalance)}`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, loanPct))}%` }}
            className="bg-amber-500 transition-all"
            title={`${bucketLabels.loanLabel}: ${formatPHP(state.loanToMhariz)}`}
          />
          {customBucketsWithBalances.map((cb) => (
            <div
              key={cb.id}
              style={{ width: `${Math.max(0, Math.min(100, cb.pct))}%` }}
              className={`transition-all ${
                cb.category === 'receivable'
                  ? 'bg-orange-500'
                  : cb.category === 'investment'
                  ? 'bg-indigo-600'
                  : 'bg-teal-600'
              }`}
              title={`${cb.label}: ${formatPHP(cb.balance)}`}
            />
          ))}
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
                + Deposit to {bucketLabels.investLabel}
              </button>
              <button
                type="button"
                onClick={() => openNewModal('atm_deposit')}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                + Deposit to {bucketLabels.atmLabel}
              </button>
              {customBuckets.map((cb) => (
                <button
                  key={cb.id}
                  type="button"
                  onClick={() => openNewModal(`custom_deposit:${cb.id}`)}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                >
                  + Deposit to {cb.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openNewModal('mhariz_repayment')}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
              >
                + Collect {bucketLabels.loanLabel} Payment
              </button>
              <button
                type="button"
                onClick={() => openNewModal('atm_withdrawal')}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
              >
                - {bucketLabels.atmLabel} Withdrawal
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
              <div className="flex flex-wrap items-center rounded-md bg-slate-100 p-0.5 text-xs">
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
                  {bucketLabels.investLabel}
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
                  {bucketLabels.atmLabel}
                </button>
                {customBuckets.map((cb) => (
                  <button
                    key={cb.id}
                    type="button"
                    onClick={() => setFilterType(`custom:${cb.id}`)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filterType === `custom:${cb.id}`
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cb.label}
                  </button>
                ))}
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
                {bucketLabels.investLabel} Inflows:{' '}
                <strong className="text-purple-900">+{formatPHP(filteredStats.investIn)}</strong>
              </span>
              {filteredStats.investOut > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {bucketLabels.investLabel} Outflows:{' '}
                    <strong className="text-red-600">-{formatPHP(filteredStats.investOut)}</strong>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                {bucketLabels.atmLabel} Deposits:{' '}
                <strong className="text-emerald-700">+{formatPHP(filteredStats.atmIn)}</strong>
              </span>
              {filteredStats.atmOut > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {bucketLabels.atmLabel} Withdrawals:{' '}
                    <strong className="text-red-600">-{formatPHP(filteredStats.atmOut)}</strong>
                  </span>
                </>
              )}
              {filteredStats.customIn > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Custom Bucket Inflows:{' '}
                    <strong className="text-indigo-800">+{formatPHP(filteredStats.customIn)}</strong>
                  </span>
                </>
              )}
              {filteredStats.customOut > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Custom Bucket Outflows:{' '}
                    <strong className="text-red-600">-{formatPHP(filteredStats.customOut)}</strong>
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
            {paginatedRecords.map((r) => {
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
                                    : r.customBucketId
                                    ? 'text-indigo-700 font-medium'
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
                                  : r.customBucketId
                                  ? 'text-indigo-900'
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
                                : r.customBucketId
                                ? 'text-indigo-800'
                                : r.invest !== 0
                                ? 'text-purple-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            {r.presentation.accountLabel}
                          </div>
                          <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                            {r.customBucketId
                              ? `${r.presentation.accountLabel} Bal: ${formatPHP(
                                  r.runningCustomBalances[r.customBucketId] || 0
                                )}`
                              : r.invest !== 0
                              ? `${bucketLabels.investLabel} Bal: ${formatPHP(r.runningInvest)}`
                              : `${bucketLabels.atmLabel} Bal: ${formatPHP(r.runningAtm)}`}
                          </div>
                        </div>

                        {/* Col 10-11: Unified Amount & Total Liquid Balance */}
                        <div className="col-span-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`text-sm font-bold ${
                              isNegative
                                ? 'text-red-600'
                                : r.customBucketId
                                ? 'text-indigo-900'
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

        {/* Pagination Bar */}
        <PaginationBar
          currentPage={currentPage}
          totalItems={filteredRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          itemLabel="transactions"
          accent="purple"
        />

        {/* Summary Footer */}
        <div className="bg-purple-50/80 px-5 py-4 border-t border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-purple-950">Current Ending Balances</div>
            <div className="text-[11px] text-purple-700 mt-0.5">
              Includes {bucketLabels.investLabel}, {bucketLabels.atmLabel},{' '}
              {customBuckets.length > 0 &&
                `${customBuckets.map((cb) => cb.label).join(', ')}, and `}
              {bucketLabels.loanLabel} Receivable
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-purple-700 block">{bucketLabels.investLabel}</span>
              <span className="font-bold text-purple-950">{formatPHP(state.investBalance)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 block">{bucketLabels.atmLabel}</span>
              <span className="font-bold text-emerald-800">{formatPHP(state.mamaAtmBalance)}</span>
            </div>
            {customBucketsWithBalances.map((cb) => (
              <div key={cb.id}>
                <span className="text-[10px] text-indigo-700 block">{cb.label}</span>
                <span className="font-bold text-indigo-950">{formatPHP(cb.balance)}</span>
              </div>
            ))}
            <div>
              <span className="text-[10px] text-amber-800 block">{bucketLabels.loanLabel}</span>
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

      {/* Configurable Account Buckets (Reference Data) Modal */}
      {isBucketModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBucketModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-purple-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-100 bg-purple-50/60 px-5 py-4 sticky top-0 z-10">
              <div>
                <h3 className="text-sm font-bold text-purple-950">
                  Configure Account Buckets (Reference Data)
                </h3>
                <p className="text-xs text-purple-700">
                  Rename core buckets or add new investment / savings buckets in Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBucketModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBucketLabels} className="p-5 space-y-5">
              {/* Section 1: Core 3 Account Buckets */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Core Account Buckets (3)
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Investment Bucket Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={draftInvestLabel}
                    onChange={(e) => setDraftInvestLabel(e.target.value)}
                    placeholder="e.g., BPI Short Term"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Liquid ATM / Cash Bucket Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={draftAtmLabel}
                      onChange={(e) => setDraftAtmLabel(e.target.value)}
                      placeholder="e.g., Mama ATM"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Loan / Receivable Bucket Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={draftLoanLabel}
                      onChange={(e) => setDraftLoanLabel(e.target.value)}
                      placeholder="e.g., Hiram ni Mhariz"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Additional Custom Buckets */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-900">
                      Additional Custom Buckets ({draftCustomBuckets.length})
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add new places where Mama&apos;s money is invested or stored (e.g., BPI Money Market, Time Deposit, GCash).
                    </p>
                  </div>
                </div>

                {draftCustomBuckets.length > 0 && (
                  <div className="space-y-2">
                    {draftCustomBuckets.map((cb) => {
                      const usedCount = state.records.filter(
                        (r) => r.customBucketId === cb.id
                      ).length;
                      return (
                        <div
                          key={cb.id}
                          className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              required
                              maxLength={60}
                              value={cb.label}
                              onChange={(e) =>
                                handleUpdateDraftCustomBucket(cb.id, {
                                  label: e.target.value
                                })
                              }
                              className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-purple-600 focus:outline-hidden"
                              placeholder="Bucket name"
                            />
                            <select
                              value={cb.category}
                              onChange={(e) =>
                                handleUpdateDraftCustomBucket(cb.id, {
                                  category: e.target.value as MamasBucketCategory
                                })
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-purple-600 focus:outline-hidden"
                            >
                              <option value="investment">Investment / UITF</option>
                              <option value="liquid_cash">Liquid Cash / Bank</option>
                              <option value="receivable">Loan / Receivable</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftCustomBucket(cb.id)}
                              disabled={usedCount > 0}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                usedCount > 0
                                  ? `Cannot delete bucket with ${usedCount} existing transaction(s)`
                                  : 'Remove custom bucket'
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              maxLength={120}
                              value={cb.description || ''}
                              onChange={(e) =>
                                handleUpdateDraftCustomBucket(cb.id, {
                                  description: e.target.value
                                })
                              }
                              placeholder="Optional subtitle (e.g., BPI Money Market Fund)"
                              className="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 focus:border-purple-600 focus:outline-hidden"
                            />
                            {usedCount > 0 && (
                              <span className="text-[11px] font-mono text-purple-700 shrink-0">
                                {usedCount} txns
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add New Bucket Sub-Form */}
                <div className="rounded-md border border-dashed border-purple-300 bg-purple-50/40 p-3 space-y-2.5">
                  <div className="text-xs font-semibold text-purple-950">
                    + Add a New Account Bucket
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      maxLength={60}
                      value={newBucketLabel}
                      onChange={(e) => setNewBucketLabel(e.target.value)}
                      placeholder="e.g., BPI Money Market or Time Deposit"
                      className="sm:col-span-3 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                    <select
                      value={newBucketCategory}
                      onChange={(e) =>
                        setNewBucketCategory(e.target.value as MamasBucketCategory)
                      }
                      className="sm:col-span-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-purple-600 focus:outline-hidden"
                    >
                      <option value="investment">Investment / UITF</option>
                      <option value="liquid_cash">Liquid Cash / Bank</option>
                      <option value="receivable">Loan / Receivable</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={120}
                      value={newBucketDescription}
                      onChange={(e) => setNewBucketDescription(e.target.value)}
                      placeholder="Short note (optional, e.g., High-yield time deposit)"
                      className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-purple-600 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddDraftCustomBucket}
                      disabled={!newBucketLabel.trim()}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-200 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to List</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setDraftInvestLabel(DEFAULT_MAMAS_BUCKET_LABELS.investLabel);
                    setDraftAtmLabel(DEFAULT_MAMAS_BUCKET_LABELS.atmLabel);
                    setDraftLoanLabel(DEFAULT_MAMAS_BUCKET_LABELS.loanLabel);
                  }}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
                >
                  Reset Core Names
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBucketModalOpen(false)}
                    disabled={isBucketSaving}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBucketSaving}
                    className="rounded-md bg-purple-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-80 flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    {isBucketSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-300" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Buckets</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
                {resolveRecordPresentation(deletingRecord, bucketLabels, customBuckets).title}
              </div>
              <div className="font-mono tabular-nums text-slate-600">
                {deletingRecord.invest !== 0 &&
                  `${bucketLabels.investLabel}: ${formatPHP(deletingRecord.invest)} `}
                {deletingRecord.mamaAtm !== 0 &&
                  `${bucketLabels.atmLabel}: ${formatPHP(deletingRecord.mamaAtm)} `}
                {deletingRecord.customBucketId &&
                  `${
                    resolveRecordPresentation(deletingRecord, bucketLabels, customBuckets)
                      .accountLabel
                  }: ${formatPHP(deletingRecord.customAmount || 0)}`}
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
                  onChange={(e) => {
                    const nextType = e.target.value as MamasEntryType;
                    setEntryType(nextType);
                    if (!editingRecord) {
                      applyDefaultNotesForEntryType(nextType);
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                >
                  <optgroup label="Core Account Buckets">
                    <option value="invest_deposit">+ Deposit to {bucketLabels.investLabel}</option>
                    <option value="invest_withdrawal">- Withdrawal from {bucketLabels.investLabel}</option>
                    <option value="atm_deposit">+ Deposit to {bucketLabels.atmLabel}</option>
                    <option value="atm_withdrawal">- Cash Withdrawal from {bucketLabels.atmLabel}</option>
                    <option value="mhariz_repayment">
                      + Collect {bucketLabels.loanLabel} Payment (to {bucketLabels.atmLabel})
                    </option>
                  </optgroup>
                  {customBuckets.length > 0 && (
                    <optgroup label="Additional Custom Buckets">
                      {customBuckets.map((cb) => (
                        <React.Fragment key={cb.id}>
                          <option value={`custom_deposit:${cb.id}`}>
                            + Deposit to {cb.label}
                          </option>
                          <option value={`custom_withdrawal:${cb.id}`}>
                            - Withdrawal from {cb.label}
                          </option>
                        </React.Fragment>
                      ))}
                    </optgroup>
                  )}
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
                  min="0.01"
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
                  placeholder={`e.g., Monthly allocation to ${bucketLabels.investLabel}...`}
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
