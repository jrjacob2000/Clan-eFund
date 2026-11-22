import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  HandCoins,
  HeartPulse,
  Landmark,
  Layers,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { ClanEFundDatabase, EFundTransaction, formatPHP } from '../data/initialLedger';
import { PaginationBar } from './PaginationBar';

export type ActivityFilterTab =
  | 'all'
  | 'money_in'
  | 'loans'
  | 'Contribution'
  | 'Medical Disbursement'
  | 'Internal Transfer'
  | 'Reimbursement'
  | 'Investment Yield'
  | 'Member Loan'
  | 'Loan Repayment';

export type ActivityAccountFilter =
  | 'ALL'
  | 'amountOnHand'
  | 'bpiMoneyMarket'
  | 'bpiShortTerm'
  | 'memberLoan';

export type ActivityViewMode = 'simple' | 'detailed';

export interface LedgerRowWithRunningTotals extends EFundTransaction {
  runningOnHand: number;
  runningMMF: number;
  runningShortTerm: number;
  runningMemberLoan: number;
  runningTotalFund: number;
}

export interface TransactionPresentation {
  displayTitle: string;
  showMemberBadge: boolean;
  cleanNote?: string;
  primaryAmount: number;
  isInternalTransfer: boolean;
  fromAccountLabel?: string;
  toAccountLabel?: string;
  accountSummaryLabel: string;
}

interface MonthOption {
  readonly value: string;
  readonly label: string;
  readonly short: string;
}

interface ActivityLedgerViewProps {
  db: ClanEFundDatabase;
  totals: {
    amountOnHand: number;
    bpiMoneyMarket: number;
    bpiShortTerm: number;
    memberLoan: number;
    totalFund: number;
  };
  canManage: boolean;
  filterTab: ActivityFilterTab;
  onFilterTabChange: (tab: ActivityFilterTab) => void;
  accountFilter: ActivityAccountFilter;
  onAccountFilterChange: (acct: ActivityAccountFilter) => void;
  memberFilter: string;
  onMemberFilterChange: (member: string) => void;
  yearFilter: string;
  onYearFilterChange: (year: string) => void;
  monthFilter: string;
  onMonthFilterChange: (month: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sortOrder: 'newest_desc' | 'oldest_asc';
  onToggleSortOrder: () => void;
  showPriorBalanceConfig: boolean;
  onTogglePriorBalanceConfig: () => void;
  availableYears: string[];
  yearRowCounts: Record<string, number>;
  monthOptions: readonly MonthOption[];
  filteredRowsCount: number;
  filteredSummary: {
    inflows: number;
    outflows: number;
    net: number;
    count: number;
  };
  paginatedRows: LedgerRowWithRunningTotals[];
  ledgerPage: number;
  ledgerPageSize: number;
  onLedgerPageChange: (page: number) => void;
  onLedgerPageSizeChange: (size: number) => void;
  formatHumanDate: (isoDate: string) => string;
  resolveTransactionPresentation: (tx: EFundTransaction) => TransactionPresentation;
  onUpdatePriorBalanceForward: (updated: ClanEFundDatabase['priorBalanceForward']) => void;
  onDownloadCsv: () => void;
  onEditTransaction: (tx: EFundTransaction) => void;
  onRequestDeleteTransaction: (tx: EFundTransaction) => void;
  onOpenNewEntry: () => void;
}

const VIEW_MODE_STORAGE_KEY = 'clan_efund_activity_view_mode_v1';

const PLAIN_CATEGORIES: Record<string, string> = {
  Contribution: 'Added to Fund',
  'Medical Disbursement': 'Medicine / Check-up',
  'Internal Transfer': 'Moved to Bank',
  Reimbursement: 'Refunded',
  'Investment Yield': 'Bank Interest',
  'Opening Balance': 'Starting Balance',
  'Member Loan': 'Borrowed',
  'Loan Repayment': 'Loan Paid Back'
};

/**
 * Formats Philippine Peso cleanly.
 * When `compactWholePesos` is true (Simple View), hides `.00` for whole peso amounts
 * so numbers are faster to scan while still showing non-zero centavos.
 */
function formatReadablePHP(amount: number, compactWholePesos: boolean): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (!compactWholePesos) {
    return formatPHP(safe);
  }
  const hasCents = Math.abs(Math.round(safe * 100) % 100) > 0;
  if (hasCents) {
    return formatPHP(safe);
  }
  const sign = safe < 0 ? '-' : '';
  const absInt = Math.round(Math.abs(safe));
  return `${sign}₱${absInt.toLocaleString('en-PH')}`;
}

function getPlainAccountName(rawLabel: string | undefined): string {
  if (!rawLabel) return 'Cash';
  const lower = rawLabel.toLowerCase();
  if (lower.includes('money market') && lower.includes('short term')) {
    return 'BPI MMF & Short Term';
  }
  if (lower.includes('money market')) return 'BPI Money Market';
  if (lower.includes('short term')) return 'BPI Short Term';
  if (lower.includes('loan')) return 'Member Loan';
  if (lower.includes('cash')) return 'Cash';
  return rawLabel;
}

function isBankAccountLabel(rawLabel: string | undefined): boolean {
  if (!rawLabel) return false;
  const lower = rawLabel.toLowerCase();
  return lower.includes('money market') || lower.includes('short term') || lower.includes('bpi');
}

function getTransactionVisual(tx: EFundTransaction, isInternalTransfer: boolean) {
  if (tx.category === 'Medical Disbursement') {
    return {
      icon: HeartPulse,
      tileClass: 'bg-red-50 text-red-700 border-red-200',
      amountClass: 'text-red-600',
      labelClass: 'text-red-600 font-medium'
    };
  }
  if (isInternalTransfer || tx.category === 'Internal Transfer') {
    return {
      icon: ArrowLeftRight,
      tileClass: 'bg-blue-50 text-blue-700 border-blue-200',
      amountClass: 'text-blue-700',
      labelClass: 'text-blue-700 font-medium'
    };
  }
  if (tx.category === 'Member Loan') {
    return {
      icon: HandCoins,
      tileClass: 'bg-amber-50 text-amber-800 border-amber-200',
      amountClass: 'text-amber-800',
      labelClass: 'text-amber-800 font-medium'
    };
  }
  if (tx.category === 'Loan Repayment') {
    return {
      icon: RotateCcw,
      tileClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amountClass: 'text-emerald-700',
      labelClass: 'text-emerald-700 font-medium'
    };
  }
  if (tx.category === 'Investment Yield') {
    return {
      icon: TrendingUp,
      tileClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amountClass: 'text-emerald-700',
      labelClass: 'text-emerald-700 font-medium'
    };
  }
  return {
    icon: ArrowDownLeft,
    tileClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amountClass: 'text-emerald-700',
    labelClass: 'text-emerald-700 font-medium'
  };
}

export const ActivityLedgerView: React.FC<ActivityLedgerViewProps> = ({
  db,
  totals,
  canManage,
  filterTab,
  onFilterTabChange,
  accountFilter,
  onAccountFilterChange,
  memberFilter,
  onMemberFilterChange,
  yearFilter,
  onYearFilterChange,
  monthFilter,
  onMonthFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortOrder,
  onToggleSortOrder,
  showPriorBalanceConfig,
  onTogglePriorBalanceConfig,
  availableYears,
  yearRowCounts,
  monthOptions,
  filteredRowsCount,
  filteredSummary,
  paginatedRows,
  ledgerPage,
  ledgerPageSize,
  onLedgerPageChange,
  onLedgerPageSizeChange,
  formatHumanDate,
  resolveTransactionPresentation,
  onUpdatePriorBalanceForward,
  onDownloadCsv,
  onEditTransaction,
  onRequestDeleteTransaction,
  onOpenNewEntry
}) => {
  const [viewMode, setViewMode] = useState<ActivityViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'simple' || saved === 'detailed') return saved;
    } catch {
      // ignore storage errors
    }
    return 'simple';
  });

  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore storage errors
    }
  }, [viewMode]);

  const isSimple = viewMode === 'simple';

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (accountFilter !== 'ALL') count++;
    if (yearFilter !== 'ALL') count++;
    if (monthFilter !== 'ALL') count++;
    if (memberFilter !== 'ALL') count++;
    if (
      filterTab !== 'all' &&
      filterTab !== 'money_in' &&
      filterTab !== 'Medical Disbursement' &&
      filterTab !== 'Internal Transfer' &&
      filterTab !== 'loans'
    ) {
      count++;
    }
    return count;
  }, [accountFilter, yearFilter, monthFilter, memberFilter, filterTab]);

  const hasAnyActiveFilter =
    yearFilter !== 'ALL' ||
    monthFilter !== 'ALL' ||
    filterTab !== 'all' ||
    accountFilter !== 'ALL' ||
    memberFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    onYearFilterChange('ALL');
    onMonthFilterChange('ALL');
    onFilterTabChange('all');
    onAccountFilterChange('ALL');
    onMemberFilterChange('ALL');
    onSearchQueryChange('');
  };

  const quickVisualFilters: {
    key: ActivityFilterTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
    idleIconClass: string;
  }[] = [
    {
      key: 'all',
      label: 'All',
      icon: Layers,
      activeClass: 'border-slate-900 bg-slate-900 text-white',
      idleIconClass: 'text-slate-600'
    },
    {
      key: 'money_in',
      label: 'Money In',
      icon: ArrowDownLeft,
      activeClass: 'border-emerald-700 bg-emerald-700 text-white',
      idleIconClass: 'text-emerald-700'
    },
    {
      key: 'Medical Disbursement',
      label: 'Medicine',
      icon: HeartPulse,
      activeClass: 'border-red-700 bg-red-700 text-white',
      idleIconClass: 'text-red-600'
    },
    {
      key: 'Internal Transfer',
      label: 'Bank Move',
      icon: ArrowLeftRight,
      activeClass: 'border-blue-700 bg-blue-700 text-white',
      idleIconClass: 'text-blue-700'
    },
    {
      key: 'loans',
      label: 'Loans',
      icon: HandCoins,
      activeClass: 'border-amber-700 bg-amber-700 text-white',
      idleIconClass: 'text-amber-700'
    }
  ];

  const isQuickFilterActive = (key: ActivityFilterTab) => {
    if (filterTab === key) return true;
    if (
      key === 'money_in' &&
      (filterTab === 'Contribution' ||
        filterTab === 'Reimbursement' ||
        filterTab === 'Investment Yield' ||
        filterTab === 'Loan Repayment')
    ) {
      return true;
    }
    if (key === 'loans' && (filterTab === 'Member Loan' || filterTab === 'Loan Repayment')) {
      return true;
    }
    return false;
  };

  const renderAccountFlowVisual = (
    tx: LedgerRowWithRunningTotals,
    pres: TransactionPresentation
  ) => {
    if (pres.isInternalTransfer) {
      const FromIcon = isBankAccountLabel(pres.fromAccountLabel) ? Landmark : Wallet;
      const ToIcon = isBankAccountLabel(pres.toAccountLabel) ? Landmark : Wallet;
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
          <FromIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>{getPlainAccountName(pres.fromAccountLabel)}</span>
          <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
          <ToIcon className="h-3.5 w-3.5 text-blue-700 shrink-0" />
          <span>{getPlainAccountName(pres.toAccountLabel)}</span>
        </span>
      );
    }

    if (tx.category === 'Member Loan' || (tx.memberLoan || 0) > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
          <Wallet className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>{getPlainAccountName(pres.fromAccountLabel)}</span>
          <ArrowRight className="h-3 w-3 text-amber-700 shrink-0" />
          <HandCoins className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>Member Loan</span>
        </span>
      );
    }

    if (tx.category === 'Loan Repayment' || (tx.memberLoan || 0) < 0) {
      const ToIcon = isBankAccountLabel(pres.toAccountLabel) ? Landmark : Wallet;
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
          <HandCoins className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>Member Loan</span>
          <ArrowRight className="h-3 w-3 text-emerald-700 shrink-0" />
          <ToIcon className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          <span>{getPlainAccountName(pres.toAccountLabel)}</span>
        </span>
      );
    }

    const AcctIcon = isBankAccountLabel(pres.accountSummaryLabel) ? Landmark : Wallet;
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
        <AcctIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <span>{getPlainAccountName(pres.accountSummaryLabel)}</span>
      </span>
    );
  };

  return (
    <section className="space-y-4">
      {/* Header Row matching Dashboard typography */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isSimple ? 'Activity' : 'Activity Ledger'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every peso added, spent on medicine, or moved to the bank
          </p>
        </div>

        {/* Simple vs Detailed Toggle */}
        <div
          role="group"
          aria-label="Display mode"
          className="inline-flex items-center self-start sm:self-auto rounded-lg bg-slate-100 p-1 border border-slate-200 shrink-0"
        >
          <button
            type="button"
            onClick={() => setViewMode('simple')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'simple'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detailed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'detailed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {/* 3-Card Summary Strip matching Dashboard KPI card typography */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>Total Fund</span>
            </span>
            <span className="text-xs text-slate-400">All 4 Accounts</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatReadablePHP(totals.totalFund, isSimple)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Money In</span>
            </span>
            <span className="text-xs text-slate-400">Filtered period</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            +{formatReadablePHP(filteredSummary.inflows, isSimple)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span>Money Spent</span>
            </span>
            <span className="text-xs text-slate-400">Filtered period</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-600">
            -{formatReadablePHP(filteredSummary.outflows, isSimple)}
          </div>
        </div>
      </div>

      {/* Visual Quick Filter Bar (Acts as both Color/Icon Guide & 1-Tap Filter) */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {quickVisualFilters.map((item) => {
            const Icon = item.icon;
            const active = isQuickFilterActive(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onFilterTabChange(item.key)}
                className={`min-h-[40px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-md border text-xs font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1.5 whitespace-nowrap shrink-0 ${
                  active
                    ? `${item.activeClass} shadow-xs`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : item.idleIconClass}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Clean Search Row + Collapsible "More Filters" Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, medicine, or date..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              aria-expanded={showMoreFilters || !isSimple}
              className={`min-h-[40px] sm:min-h-0 flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 rounded-md border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                showMoreFilters || advancedFilterCount > 0
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>
                {showMoreFilters ? 'Hide Filters' : 'More Filters'}
                {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
              </span>
              {showMoreFilters ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>

            {hasAnyActiveFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="min-h-[40px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {(showMoreFilters || !isSimple) && (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            {/* Account Bucket Filter */}
            <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar">
              <div className="inline-flex items-center gap-1.5 text-xs min-w-max">
                <span className="text-slate-500 font-semibold shrink-0 mr-1">Where Money Is:</span>
                {(
                  [
                    ['ALL', `All Accounts (${formatReadablePHP(totals.totalFund, isSimple)})`],
                    [
                      'amountOnHand',
                      `Cash on Hand (${formatReadablePHP(totals.amountOnHand, isSimple)})`
                    ],
                    [
                      'bpiMoneyMarket',
                      `Money Market (${formatReadablePHP(totals.bpiMoneyMarket, isSimple)})`
                    ],
                    [
                      'bpiShortTerm',
                      `Short Term (${formatReadablePHP(totals.bpiShortTerm, isSimple)})`
                    ],
                    [
                      'memberLoan',
                      `Member Loans (${formatReadablePHP(totals.memberLoan, isSimple)})`
                    ]
                  ] as [ActivityAccountFilter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onAccountFilterChange(key)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      accountFilter === key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year & Month Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 min-w-0">
              <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar">
                <div className="inline-flex items-center gap-1.5 min-w-max">
                  <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Year:</span>
                  <button
                    type="button"
                    onClick={() => onYearFilterChange('ALL')}
                    className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                      yearFilter === 'ALL'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All Years ({db.transactions.length})
                  </button>
                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => onYearFilterChange(yr)}
                      className={`px-3 py-1.5 rounded-md border text-xs font-semibold font-mono tabular-nums transition-colors shrink-0 ${
                        yearFilter === yr
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {yr} ({yearRowCounts[yr] || 0})
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar">
                <div className="inline-flex items-center gap-1 min-w-max">
                  <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Month:</span>
                  {monthOptions.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onMonthFilterChange(m.value)}
                      className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                        monthFilter === m.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {m.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Granular Type, Person, Sort, Grouping, Opening Balance, CSV */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <select
                value={filterTab}
                onChange={(e) => onFilterTabChange(e.target.value as ActivityFilterTab)}
                aria-label="Filter by type"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-hidden"
              >
                <option value="all">Type: All</option>
                <option value="money_in">Money In (All)</option>
                <option value="Contribution">Added to Fund</option>
                <option value="Medical Disbursement">Medicine / Check-up</option>
                <option value="Internal Transfer">Moved to Bank</option>
                <option value="Reimbursement">Refunded</option>
                <option value="Investment Yield">Bank Interest</option>
                <option value="loans">Loans (All)</option>
                <option value="Member Loan">Borrowed</option>
                <option value="Loan Repayment">Loan Paid Back</option>
              </select>

              <select
                value={memberFilter}
                onChange={(e) => onMemberFilterChange(e.target.value)}
                aria-label="Filter by person"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-hidden"
              >
                <option value="ALL">Everyone &amp; All Accounts</option>
                {db.members.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="Papa">Papa (Medicine)</option>
                <option value="Mama">Mama (Medicine)</option>
                <option value="Parents">Parents (Medicine)</option>
                <option value="BPI Funds">Bank Move</option>
              </select>

              <button
                type="button"
                onClick={onToggleSortOrder}
                className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>{sortOrder === 'newest_desc' ? 'Newest First' : 'Oldest First'}</span>
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={onTogglePriorBalanceConfig}
                  className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Opening Bal</span>
                </button>
              )}

              <button
                type="button"
                onClick={onDownloadCsv}
                className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Quiet Result Count Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          <span>
            Showing{' '}
            <strong className="font-mono tabular-nums text-slate-900">
              {filteredSummary.count}
            </strong>{' '}
            of {db.transactions.length} entries
          </span>
          <span className="font-mono tabular-nums text-slate-600">
            Change:{' '}
            <strong
              className={
                filteredSummary.net > 0
                  ? 'text-emerald-700'
                  : filteredSummary.net < 0
                  ? 'text-red-600'
                  : 'text-slate-800'
              }
            >
              {filteredSummary.net > 0
                ? `+${formatReadablePHP(filteredSummary.net, isSimple)}`
                : formatReadablePHP(filteredSummary.net, isSimple)}
            </strong>
          </span>
        </div>
      </div>

      {/* Collapsible Opening Balance Configuration (Admin-only) */}
      {canManage && showPriorBalanceConfig && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Opening Balance Forward (Prior to April 27, 2026)
              </h3>
              <p className="text-xs text-slate-500">
                Cumulative balances accumulated prior to April 27, 2026 so your current account
                balances match{' '}
                <span className="font-mono tabular-nums font-semibold text-slate-700">
                  ₱11,970.00 · ₱78,000.00 · ₱6,800.00
                </span>
                .
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={db.priorBalanceForward.included}
                onChange={(e) =>
                  onUpdatePriorBalanceForward({
                    ...db.priorBalanceForward,
                    included: e.target.checked
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>Include Opening Balance</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Opening Cash on Hand
              </label>
              <input
                type="number"
                step="0.01"
                value={db.priorBalanceForward.amountOnHand}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onUpdatePriorBalanceForward({
                    ...db.priorBalanceForward,
                    amountOnHand: val
                  });
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Opening BPI Money Market
              </label>
              <input
                type="number"
                step="0.01"
                value={db.priorBalanceForward.bpiMoneyMarket}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onUpdatePriorBalanceForward({
                    ...db.priorBalanceForward,
                    bpiMoneyMarket: val
                  });
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Opening BPI Short Term
              </label>
              <input
                type="number"
                step="0.01"
                value={db.priorBalanceForward.bpiShortTerm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onUpdatePriorBalanceForward({
                    ...db.priorBalanceForward,
                    bpiShortTerm: val
                  });
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {/* Transaction Stream: Simple Visual Cards OR Detailed Ledger Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {!isSimple && (
          <div className="hidden md:grid md:grid-cols-12 items-center border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold text-slate-500">
            <div className="col-span-2">Date</div>
            <div className={canManage ? 'col-span-4' : 'col-span-5'}>What Happened</div>
            <div className="col-span-3">Where It Went</div>
            <div className="col-span-2 text-right">Amount &amp; Balance</div>
            {canManage && <div className="col-span-1 text-right">Manage</div>}
          </div>
        )}

        {filteredRowsCount === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching entries found</p>
            <p className="mt-1 text-xs text-slate-500">
              Tap Clear Filters to see all family fund activity again.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={onOpenNewEntry}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Add Entry
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {paginatedRows.map((tx) => {
              const pres = resolveTransactionPresentation(tx);
              const visual = getTransactionVisual(tx, pres.isInternalTransfer);
              const RowIcon = visual.icon;
              const plainCategory = PLAIN_CATEGORIES[tx.category] || tx.category;

                  const formattedPrimaryAmount = pres.isInternalTransfer
                    ? `⇄ ${formatReadablePHP(pres.primaryAmount, isSimple)}`
                    : tx.category === 'Member Loan'
                    ? formatReadablePHP(pres.primaryAmount, isSimple)
                    : pres.primaryAmount > 0
                    ? `+${formatReadablePHP(pres.primaryAmount, isSimple)}`
                    : formatReadablePHP(pres.primaryAmount, isSimple);

                  if (isSimple) {
                    return (
                      <div
                        key={tx.id}
                        className="px-4 py-3.5 sm:px-5 transition-colors hover:bg-slate-50/80 flex flex-col gap-2"
                      >
                        <div className="flex items-start gap-3">
                          {/* Color-coded Transaction Type Icon */}
                          <div
                            className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${visual.tileClass}`}
                            aria-hidden="true"
                          >
                            <RowIcon className="h-4 w-4" />
                          </div>

                          {/* Center Info matching Dashboard row typography */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 leading-snug">
                                  {pres.displayTitle}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                                  <span className={visual.labelClass}>{plainCategory}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums text-slate-600">
                                    {formatHumanDate(tx.date)}
                                  </span>
                                  {pres.showMemberBadge && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-medium text-slate-700">
                                        {tx.memberOrBeneficiary}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Right Amount & Balance After */}
                              <div className="text-right shrink-0">
                                <div
                                  className={`text-sm sm:text-base font-bold font-mono tabular-nums whitespace-nowrap ${visual.amountClass}`}
                                >
                                  {formattedPrimaryAmount}
                                </div>
                                <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                                  Balance:{' '}
                                  <span className="font-medium text-slate-700">
                                    {formatReadablePHP(tx.runningTotalFund, true)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Visual Account Routing & Optional Note */}
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {renderAccountFlowVisual(tx, pres)}
                                {pres.cleanNote && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span className="text-slate-500">{pres.cleanNote}</span>
                                  </>
                                )}
                              </div>

                              {canManage && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onEditTransaction(tx)}
                                    className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                                    aria-label={`Edit ${tx.description}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRequestDeleteTransaction(tx)}
                                    className="px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 flex items-center gap-1"
                                    aria-label={`Delete ${tx.description}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Detailed View Row
                  return (
                    <div
                      key={tx.id}
                      className="group p-4 sm:px-5 sm:py-3.5 transition-colors hover:bg-slate-50/80 md:grid md:grid-cols-12 md:items-center md:gap-4 flex flex-col gap-2"
                    >
                      {/* Mobile Header */}
                      <div className="flex items-start justify-between gap-3 md:hidden">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${visual.tileClass}`}
                            aria-hidden="true"
                          >
                            <RowIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 leading-snug">
                              {pres.displayTitle}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span className="font-mono tabular-nums text-slate-600">
                                {formatHumanDate(tx.date)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className={visual.labelClass}>{plainCategory}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${visual.amountClass}`}
                          >
                            {formattedPrimaryAmount}
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-500">
                            Balance: {formatPHP(tx.runningTotalFund)}
                          </div>
                        </div>
                      </div>

                      {/* Desktop Date */}
                      <div className="hidden md:block md:col-span-2">
                        <div className="text-sm font-medium text-slate-900 font-mono tabular-nums">
                          {formatHumanDate(tx.date)}
                        </div>
                      </div>

                      {/* Desktop Description with Icon */}
                      <div
                        className={`hidden md:flex md:items-center md:gap-3 ${
                          canManage ? 'md:col-span-4' : 'md:col-span-5'
                        } min-w-0`}
                      >
                        <div
                          className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${visual.tileClass}`}
                          aria-hidden="true"
                        >
                          <RowIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {pres.displayTitle}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className={visual.labelClass}>{plainCategory}</span>
                            {pres.showMemberBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-slate-700">
                                  {tx.memberOrBeneficiary}
                                </span>
                              </>
                            )}
                            {pres.cleanNote && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-500 truncate max-w-[240px]">
                                  {pres.cleanNote}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Account Routing & Bucket Running Balance */}
                      <div className="md:col-span-3 text-xs text-slate-600 pl-10 md:pl-0">
                        {renderAccountFlowVisual(tx, pres)}
                        <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                          {tx.amountOnHand !== 0 && `Cash Bal: ${formatPHP(tx.runningOnHand)}`}
                          {tx.bpiMoneyMarket !== 0 &&
                            tx.amountOnHand === 0 &&
                            `MMF Bal: ${formatPHP(tx.runningMMF)}`}
                          {tx.bpiShortTerm !== 0 &&
                            tx.amountOnHand === 0 &&
                            tx.bpiMoneyMarket === 0 &&
                            `Short Term Bal: ${formatPHP(tx.runningShortTerm)}`}
                          {(tx.memberLoan || 0) !== 0 &&
                            tx.amountOnHand === 0 &&
                            tx.bpiMoneyMarket === 0 &&
                            tx.bpiShortTerm === 0 &&
                            `Loan Bal: ${formatPHP(tx.runningMemberLoan)}`}
                        </div>
                      </div>

                      {/* Desktop Amount & Total Fund */}
                      <div className="hidden md:block md:col-span-2 md:text-right">
                        <div
                          className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${visual.amountClass}`}
                        >
                          {formattedPrimaryAmount}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          Balance: {formatPHP(tx.runningTotalFund)}
                        </div>
                      </div>

                      {/* Admin Actions */}
                      {canManage && (
                        <div className="md:col-span-1 flex items-center justify-end gap-2 md:gap-1 pt-2 md:pt-0 border-t border-slate-100 md:border-0">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 md:p-1.5 rounded-md text-xs font-medium text-slate-700 md:text-slate-500 bg-slate-100 md:bg-transparent hover:bg-slate-200/70 hover:text-slate-900 min-h-[38px] md:min-h-0"
                            title="Edit transaction"
                            aria-label={`Edit ${tx.description}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="md:hidden">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDeleteTransaction(tx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 md:p-1.5 rounded-md text-xs font-medium text-red-600 md:text-slate-500 bg-red-50 md:bg-transparent hover:bg-red-100 md:hover:bg-red-50 hover:text-red-700 min-h-[38px] md:min-h-0"
                            title="Delete transaction"
                            aria-label={`Delete ${tx.description}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="md:hidden">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

            {/* Opening Balance Row */}
            {db.priorBalanceForward.included &&
              filterTab === 'all' &&
              memberFilter === 'ALL' &&
              !searchQuery && (
                <div className="grid grid-cols-1 gap-2 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-600 md:grid-cols-12 md:items-center md:gap-4">
                  <div className="md:col-span-2 font-mono tabular-nums text-slate-500">
                    Before Apr 27, 2026
                  </div>
                  <div className={canManage ? 'md:col-span-4' : 'md:col-span-5'}>
                    <div className="font-semibold text-slate-800">
                      {db.priorBalanceForward.label}
                    </div>
                    <div className="text-slate-500">
                      Cash: {formatReadablePHP(db.priorBalanceForward.amountOnHand, isSimple)} · MMF:{' '}
                      {formatReadablePHP(db.priorBalanceForward.bpiMoneyMarket, isSimple)} · Short
                      Term: {formatReadablePHP(db.priorBalanceForward.bpiShortTerm, isSimple)}
                    </div>
                  </div>
                  <div className="md:col-span-3 text-slate-500">Starting Balance</div>
                  <div className="md:col-span-2 md:text-right font-mono tabular-nums font-bold text-slate-800">
                    {formatReadablePHP(
                      db.priorBalanceForward.amountOnHand +
                        db.priorBalanceForward.bpiMoneyMarket +
                        db.priorBalanceForward.bpiShortTerm,
                      isSimple
                    )}
                  </div>
                  {canManage && (
                    <div className="md:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={onTogglePriorBalanceConfig}
                        className="font-medium text-slate-600 hover:text-slate-900 underline"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Pagination Bar */}
        <PaginationBar
          currentPage={ledgerPage}
          totalItems={filteredRowsCount}
          pageSize={ledgerPageSize}
          onPageChange={onLedgerPageChange}
          onPageSizeChange={onLedgerPageSizeChange}
          pageSizeOptions={[10, 15, 25, 50]}
          itemLabel="entries"
        />

        {/* Clean Ledger Summary Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
            <span>
              Cash on Hand:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatReadablePHP(totals.amountOnHand, isSimple)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              BPI Money Market:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatReadablePHP(totals.bpiMoneyMarket, isSimple)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              BPI Short Term:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatReadablePHP(totals.bpiShortTerm, isSimple)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Member Loans:{' '}
              <strong className="font-mono tabular-nums text-amber-900">
                {formatReadablePHP(totals.memberLoan, isSimple)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Total Fund:</span>
            <span className="font-mono tabular-nums text-base font-bold text-emerald-700">
              {formatReadablePHP(totals.totalFund, isSimple)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
