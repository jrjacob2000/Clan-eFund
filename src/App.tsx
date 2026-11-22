import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  Plus,
  Download,
  Database,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  LayoutDashboard,
  ReceiptText,
  Users,
  HeartPulse,
  PiggyBank,
  HandCoins,
  HelpCircle
} from 'lucide-react';
import {
  APP_VERSION,
  ClanEFundDatabase,
  EFundTransaction,
  EntryCategory,
  INITIAL_EFUND_DB,
  MAMAS_SAVINGS_DATA,
  EMPTY_MAMAS_SAVINGS_STATE,
  MamasSavingsEntry,
  MamasSavingsState,
  calculateMamasTotals,
  calculateTotals,
  formatPHP
} from './data/initialLedger';
import {
  ADMIN_EMAIL,
  EXPORT_JSON_FILENAME,
  FIRESTORE_DATABASE_ID,
  MAMAS_SAVINGS_CACHE_KEY,
  clampNumber,
  deleteTransactionFromFirestore,
  ensureSharedLedgerInitializedInFirestore,
  googleSignIn,
  initAuth,
  isLedgerAdmin,
  logout,
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets,
  purgeMamasSavingsLocalCache,
  replaceEntireLedgerInFirestore,
  sanitizeCsvCell,
  sanitizeDocId,
  sanitizeMembersList,
  saveMamasSavingsToFirestore,
  saveTransactionToFirestore,
  subscribeToMamasSavings,
  subscribeToSharedLedger,
  updateLedgerConfigInFirestore
} from './services/firebaseDb';
import { EntryFormModal, EntryPresetMode } from './components/EntryFormModal';
import { DriveConfirmModal } from './components/DriveConfirmModal';
import { MamasSavingsView } from './components/MamasSavingsView';
import { DatabaseManagementView } from './components/DatabaseManagementView';
import { HelpGuideView } from './components/HelpGuideView';
import { PaginationBar } from './components/PaginationBar';
import {
  ActivityAccountFilter,
  ActivityFilterTab,
  ActivityLedgerView
} from './components/ActivityLedgerView';

export type ActiveAccount = 'clan_efund' | 'mamas_savings';
type ActiveSection = 'dashboard' | 'ledger' | 'contributors' | 'medical' | 'database' | 'help';
type FilterTab = ActivityFilterTab;
type AccountFilter = ActivityAccountFilter;

const LOCAL_STORAGE_CACHE_KEY = `clan_efund_working_copy_v6_${FIRESTORE_DATABASE_ID}`;
const MAX_IMPORT_JSON_BYTES = 5 * 1024 * 1024; // 5 MB safety limit
const VALID_IMPORT_CATEGORIES = new Set<EntryCategory>([
  'Contribution',
  'Medical Disbursement',
  'Internal Transfer',
  'Reimbursement',
  'Investment Yield',
  'Opening Balance',
  'Member Loan',
  'Loan Repayment'
]);

export const LEDGER_MONTH_OPTIONS = [
  { value: 'ALL', label: 'All Months', short: 'All' },
  { value: '01', label: 'January', short: 'Jan' },
  { value: '02', label: 'February', short: 'Feb' },
  { value: '03', label: 'March', short: 'Mar' },
  { value: '04', label: 'April', short: 'Apr' },
  { value: '05', label: 'May', short: 'May' },
  { value: '06', label: 'June', short: 'Jun' },
  { value: '07', label: 'July', short: 'Jul' },
  { value: '08', label: 'August', short: 'Aug' },
  { value: '09', label: 'September', short: 'Sep' },
  { value: '10', label: 'October', short: 'Oct' },
  { value: '11', label: 'November', short: 'Nov' },
  { value: '12', label: 'December', short: 'Dec' }
] as const;

export const MATRIX_YEARS = ['2026', '2025', '2024'] as const;
export type MatrixYear = (typeof MATRIX_YEARS)[number];

export const MATRIX_MONTHS_BY_YEAR: Record<
  MatrixYear,
  { key: string; label: string; defaultDate: string }[]
> = {
  '2026': [
    { key: '2026-01', label: 'Jan', defaultDate: '2026-01-28' },
    { key: '2026-02', label: 'Feb', defaultDate: '2026-02-28' },
    { key: '2026-03', label: 'Mar', defaultDate: '2026-03-28' },
    { key: '2026-04', label: 'Apr', defaultDate: '2026-04-27' },
    { key: '2026-05', label: 'May', defaultDate: '2026-05-25' },
    { key: '2026-06', label: 'Jun', defaultDate: '2026-06-30' },
    { key: '2026-07', label: 'Jul', defaultDate: '2026-07-09' },
    { key: '2026-08', label: 'Aug', defaultDate: '2026-08-31' },
    { key: '2026-09', label: 'Sep', defaultDate: '2026-09-30' },
    { key: '2026-10', label: 'Oct', defaultDate: '2026-10-26' },
    { key: '2026-11', label: 'Nov', defaultDate: '2026-11-28' },
    { key: '2026-12', label: 'Dec', defaultDate: '2026-12-28' }
  ],
  '2025': [
    { key: '2025-01', label: 'Jan', defaultDate: '2025-01-20' },
    { key: '2025-02', label: 'Feb', defaultDate: '2025-02-23' },
    { key: '2025-03', label: 'Mar', defaultDate: '2025-03-23' },
    { key: '2025-04', label: 'Apr', defaultDate: '2025-04-29' },
    { key: '2025-05', label: 'May', defaultDate: '2025-05-20' },
    { key: '2025-06', label: 'Jun', defaultDate: '2025-06-28' },
    { key: '2025-07', label: 'Jul', defaultDate: '2025-07-29' },
    { key: '2025-08', label: 'Aug', defaultDate: '2025-08-29' },
    { key: '2025-09', label: 'Sep', defaultDate: '2025-09-30' },
    { key: '2025-10', label: 'Oct', defaultDate: '2025-10-28' },
    { key: '2025-11', label: 'Nov', defaultDate: '2025-11-27' },
    { key: '2025-12', label: 'Dec', defaultDate: '2025-12-28' }
  ],
  '2024': [
    { key: '2024-01', label: 'Jan', defaultDate: '2024-01-27' },
    { key: '2024-02', label: 'Feb', defaultDate: '2024-02-18' },
    { key: '2024-03', label: 'Mar', defaultDate: '2024-03-20' },
    { key: '2024-04', label: 'Apr', defaultDate: '2024-04-18' },
    { key: '2024-05', label: 'May', defaultDate: '2024-05-01' },
    { key: '2024-06', label: 'Jun', defaultDate: '2024-06-19' },
    { key: '2024-07', label: 'Jul', defaultDate: '2024-07-06' },
    { key: '2024-08', label: 'Aug', defaultDate: '2024-08-29' },
    { key: '2024-09', label: 'Sep', defaultDate: '2024-09-29' },
    { key: '2024-10', label: 'Oct', defaultDate: '2024-10-28' },
    { key: '2024-11', label: 'Nov', defaultDate: '2024-11-20' },
    { key: '2024-12', label: 'Dec', defaultDate: '2024-12-28' }
  ]
};

function formatHumanDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dateObj.getTime())) return isoDate;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Resolves the primary amount, direction, account routing, and de-duplicated
 * row labels for a transaction so row subtitles don't repeat the title/member/category.
 */
function resolveTransactionPresentation(tx: EFundTransaction): {
  displayTitle: string;
  showMemberBadge: boolean;
  cleanNote?: string;
  primaryAmount: number;
  isInternalTransfer: boolean;
  fromAccountLabel?: string;
  toAccountLabel?: string;
  accountSummaryLabel: string;
} {
  const { amountOnHand, bpiMoneyMarket, bpiShortTerm } = tx;
  const memberLoan = tx.memberLoan || 0;
  const net = amountOnHand + bpiMoneyMarket + bpiShortTerm + memberLoan;

  const rawDesc = (tx.description || '').trim();
  const rawMember = (tx.memberOrBeneficiary || '').trim();
  const displayTitle =
    rawDesc && rawMember && rawDesc.toLowerCase() === rawMember.toLowerCase()
      ? rawMember
      : rawDesc
      ? rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1)
      : rawMember || tx.category;

  const titleLower = displayTitle.toLowerCase();
  const memberLower = rawMember.toLowerCase();
  const showMemberBadge =
    Boolean(rawMember) &&
    memberLower !== 'bpi funds' &&
    !titleLower.includes(memberLower);

  const rawNote = (tx.notes || '').trim();
  const noteLower = rawNote.toLowerCase();
  const isRedundantBoilerplateNote =
    !rawNote ||
    noteLower === titleLower ||
    noteLower.startsWith('monthly contribution from ') ||
    noteLower.startsWith('medical expense for ') ||
    noteLower === 'internal fund transfer / investment placement' ||
    noteLower === 'emergency medical reimbursement to replenish cash on hand' ||
    noteLower === 'accrued investment return / navpu gain' ||
    noteLower === 'member loan assistance extended from e-fund cash' ||
    noteLower === 'collected member loan repayment back into cash on hand';
  const cleanNote = isRedundantBoilerplateNote ? undefined : rawNote;

  const base = {
    displayTitle,
    showMemberBadge,
    cleanNote
  };

  if (tx.category === 'Member Loan' || memberLoan > 0) {
    let sourceLabel = 'Cash on Hand';
    if (bpiMoneyMarket < 0) sourceLabel = 'Money Market Fund';
    else if (bpiShortTerm < 0) sourceLabel = 'Short Term Fund';
    return {
      ...base,
      primaryAmount: memberLoan > 0 ? memberLoan : Math.abs(amountOnHand),
      isInternalTransfer: false,
      fromAccountLabel: sourceLabel,
      toAccountLabel: 'Member Loans (Receivable)',
      accountSummaryLabel: `${sourceLabel} → Member Loan (Receivable)`
    };
  }

  if (tx.category === 'Loan Repayment' || memberLoan < 0) {
    let targetLabel = 'Cash on Hand';
    if (bpiMoneyMarket > 0 && bpiShortTerm > 0) {
      targetLabel = 'Money Market & Short Term';
    } else if (bpiMoneyMarket > 0) {
      targetLabel = 'Money Market Fund';
    } else if (bpiShortTerm > 0) {
      targetLabel = 'Short Term Fund';
    }
    return {
      ...base,
      primaryAmount: Math.abs(
        memberLoan || amountOnHand + bpiMoneyMarket + bpiShortTerm
      ),
      isInternalTransfer: false,
      fromAccountLabel: 'Member Loan (Receivable)',
      toAccountLabel: targetLabel,
      accountSummaryLabel: `Member Loan Repayment → ${targetLabel}`
    };
  }

  const nonZeroCount =
    (amountOnHand !== 0 ? 1 : 0) +
    (bpiMoneyMarket !== 0 ? 1 : 0) +
    (bpiShortTerm !== 0 ? 1 : 0);

  if (tx.category === 'Internal Transfer' || (nonZeroCount >= 2 && Math.abs(net) < 0.01)) {
    let fromLabel = 'Cash on Hand';
    let toLabel = 'BPI Money Market';
    const transferAmt = Math.max(
      Math.abs(amountOnHand),
      Math.abs(bpiMoneyMarket),
      Math.abs(bpiShortTerm)
    );

    if (amountOnHand < 0) fromLabel = 'Cash on Hand';
    else if (bpiShortTerm < 0) fromLabel = 'BPI Short Term';
    else if (bpiMoneyMarket < 0) fromLabel = 'BPI Money Market';

    if (bpiMoneyMarket > 0) toLabel = 'BPI Money Market';
    else if (bpiShortTerm > 0) toLabel = 'BPI Short Term';
    else if (amountOnHand > 0) toLabel = 'Cash on Hand';

    return {
      ...base,
      primaryAmount: transferAmt,
      isInternalTransfer: true,
      fromAccountLabel: fromLabel,
      toAccountLabel: toLabel,
      accountSummaryLabel: `${fromLabel} → ${toLabel}`
    };
  }

  if (amountOnHand !== 0 && bpiMoneyMarket === 0 && bpiShortTerm === 0) {
    return {
      ...base,
      primaryAmount: amountOnHand,
      isInternalTransfer: false,
      accountSummaryLabel: 'Cash on Hand'
    };
  }

  if (bpiMoneyMarket !== 0 && amountOnHand === 0 && bpiShortTerm === 0) {
    return {
      ...base,
      primaryAmount: bpiMoneyMarket,
      isInternalTransfer: false,
      accountSummaryLabel: 'Money Market Fund'
    };
  }

  if (bpiShortTerm !== 0 && amountOnHand === 0 && bpiMoneyMarket === 0) {
    return {
      ...base,
      primaryAmount: bpiShortTerm,
      isInternalTransfer: false,
      accountSummaryLabel: 'Short Term Fund'
    };
  }

  return {
    ...base,
    primaryAmount: net,
    isInternalTransfer: false,
    accountSummaryLabel: 'Multi-Account Split'
  };
}

export default function App() {
  const [db, setDb] = useState<ClanEFundDatabase>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 25) {
          const normalizedTxs = parsed.transactions.map((t: EFundTransaction) => {
            const descLower = String(t.description || '').toLowerCase();
            if (
              (t.id === 'row-36' || descLower.includes('hiram ni dondon')) &&
              t.category === 'Medical Disbursement'
            ) {
              return {
                ...t,
                category: 'Member Loan' as EntryCategory,
                memberLoan: Math.abs(t.amountOnHand + t.bpiMoneyMarket + t.bpiShortTerm),
                highlightAlert: false
              };
            }
            if (
              (t.id === 'row-43' || t.id === 'row-90' || t.id === 'row-109') &&
              t.category === 'Reimbursement'
            ) {
              return {
                ...t,
                category: 'Loan Repayment' as EntryCategory,
                memberLoan: -Math.abs(t.amountOnHand + t.bpiMoneyMarket + t.bpiShortTerm),
                highlightAlert: false
              };
            }
            return t;
          });
          return {
            ...INITIAL_EFUND_DB,
            ...parsed,
            transactions: normalizedTxs
          };
        }
      }
    } catch {
      // Fallback to initial data
    }
    return INITIAL_EFUND_DB;
  });

  const [activeAccount, setActiveAccount] = useState<ActiveAccount>('clan_efund');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ALL');
  const [memberFilter, setMemberFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest_desc' | 'oldest_asc'>('newest_desc');
  const [showPriorBalanceConfig, setShowPriorBalanceConfig] = useState<boolean>(false);
  const [selectedMatrixYear, setSelectedMatrixYear] = useState<MatrixYear>('2026');

  // Pagination state across all grids in Clan E-Fund
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(15);
  const [matrixPage, setMatrixPage] = useState<number>(1);
  const [matrixPageSize, setMatrixPageSize] = useState<number>(8);
  const [medicalPage, setMedicalPage] = useState<number>(1);
  const [medicalPageSize, setMedicalPageSize] = useState<number>(10);
  const [transferPage, setTransferPage] = useState<number>(1);
  const [transferPageSize, setTransferPageSize] = useState<number>(10);

  // Mama's Personal Savings State (Strictly private to jrjacob2000@gmail.com)
  const [mamasState, setMamasState] = useState<MamasSavingsState>(EMPTY_MAMAS_SAVINGS_STATE);

  // Firebase Auth & Real-Time Firestore state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Entry Modal state (Admin-only)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [isSavingEntry, setIsSavingEntry] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<EFundTransaction | null>(null);
  const [presetMember, setPresetMember] = useState<string | null>(null);
  const [presetMode, setPresetMode] = useState<EntryPresetMode>('contribution');
  const [presetDate, setPresetDate] = useState<string | null>(null);

  // Auto-dismiss success notification banner after 5 seconds
  useEffect(() => {
    if (statusBanner?.type === 'success') {
      const timer = setTimeout(() => {
        setStatusBanner(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusBanner]);

  // Confirmation Modal state (Admin-only row deletion)
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    targetRow?: EFundTransaction;
  }>({
    isOpen: false
  });

  // Role check: Only jrjacob2000@gmail.com can access Mama's Savings and manage records
  const canManage = useMemo(() => isLedgerAdmin(user), [user]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(db));
    } catch {
      // Ignore storage quota errors
    }
  }, [db]);

  // Persist Mama's savings cache ONLY when authenticated as jrjacob2000@gmail.com
  useEffect(() => {
    if (!canManage) {
      purgeMamasSavingsLocalCache();
      return;
    }
    try {
      localStorage.setItem(MAMAS_SAVINGS_CACHE_KEY, JSON.stringify(mamasState));
    } catch {
      // Ignore storage quota errors
    }
  }, [mamasState, canManage]);

  // Subscribe to Mama's personal savings from Firestore ONLY if user is verified manager (jrjacob2000@gmail.com)
  // Strict Security Redirect: If user is not manager, keep them out of restricted accounts/sections
  useEffect(() => {
    if (!canManage) {
      if (activeAccount === 'mamas_savings') {
        setActiveAccount('clan_efund');
      }
      if (activeSection === 'database') {
        setActiveSection('dashboard');
      }
    }
  }, [canManage, activeAccount, activeSection]);

  useEffect(() => {
    if (!canManage || !user) {
      setMamasState(EMPTY_MAMAS_SAVINGS_STATE);
      return;
    }

    // Load cached or initial state for instant response for the manager
    try {
      const saved = localStorage.getItem(MAMAS_SAVINGS_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
          setMamasState(calculateMamasTotals(parsed));
        } else {
          setMamasState(calculateMamasTotals(MAMAS_SAVINGS_DATA));
        }
      } else {
        setMamasState(calculateMamasTotals(MAMAS_SAVINGS_DATA));
      }
    } catch {
      setMamasState(calculateMamasTotals(MAMAS_SAVINGS_DATA));
    }

    const unsub = subscribeToMamasSavings(
      (data) => {
        setMamasState(calculateMamasTotals(data));
      },
      () => {
        // Silently keep local state if offline
      }
    );
    return () => unsub();
  }, [canManage, user, activeAccount]);

  const handleUpdateMamasSavings = async (newState: MamasSavingsState) => {
    const previousState = mamasState;
    const computed = calculateMamasTotals(newState);
    setMamasState(computed);
    if (!canManage || !user) return;

    setIsSyncingFirestore(true);
    try {
      await saveMamasSavingsToFirestore(user.uid, computed);
      setStatusBanner({
        type: 'success',
        message: "Saved entry to Mama's personal savings and synced to Firestore."
      });
    } catch (err: any) {
      setMamasState(previousState);
      setStatusBanner({
        type: 'error',
        message: err?.message || "Failed to sync Mama's savings to Firestore."
      });
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setIsAuthReady(true);
      },
      () => {
        setUser(null);
        setIsAuthReady(true);
        setShowPriorBalanceConfig(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to the shared clan ledger (/ledgers/clan-efund-main) in real time for all viewers & admin
  useEffect(() => {
    if (!isAuthReady) return;

    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const setupSubscription = async () => {
      setIsSyncingFirestore(true);
      try {
        // Only the verified Admin can initialize/seed the shared ledger if it doesn't exist yet
        if (user && isLedgerAdmin(user)) {
          const initRes = await ensureSharedLedgerInitializedInFirestore(user.uid, db);
          if (!cancelled && initRes.createdNew) {
            setStatusBanner({
              type: 'success',
              message: `Initialized shared Clan E-Fund ledger in Firebase Firestore (${db.transactions.length} transactions).`
            });
          }
        }

        if (cancelled) return;

        unsubFirestore = subscribeToSharedLedger(
          (firestorePatch) => {
            setDb((prev) => ({
              ...prev,
              ...firestorePatch,
              priorBalanceForward: firestorePatch.priorBalanceForward
                ? {
                    ...prev.priorBalanceForward,
                    ...firestorePatch.priorBalanceForward
                  }
                : prev.priorBalanceForward
            }));
            setIsSyncingFirestore(false);
          },
          (errMsg) => {
            setStatusBanner({
              type: 'error',
              message: `Firestore sync error: ${errMsg}`
            });
            setIsSyncingFirestore(false);
          }
        );

        // Clear initial syncing spinner if the ledger hasn't been initialized by the admin yet
        setTimeout(() => {
          if (!cancelled) setIsSyncingFirestore(false);
        }, 1200);
      } catch (err: any) {
        if (!cancelled) {
          setStatusBanner({
            type: 'error',
            message: err?.message || 'Failed to connect to Firebase Firestore ledger.'
          });
          setIsSyncingFirestore(false);
        }
      }
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (unsubFirestore) {
        unsubFirestore();
      }
    };
  }, [isAuthReady, user]);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setStatusBanner(null);
    try {
      const signedInUser = await googleSignIn();
      if (signedInUser) {
        setUser(signedInUser);
        if (!isLedgerAdmin(signedInUser)) {
          setStatusBanner({
            type: 'info',
            message: `Signed in as ${signedInUser.email} in View-Only Contributor mode. Only ${ADMIN_EMAIL} can add, edit, or delete records.`
          });
        }
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Firebase Google sign-in failed. Please try again.'
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleExecuteConfirmedAction = async () => {
    if (!canManage || !user) {
      setStatusBanner({
        type: 'error',
        message: `View-Only mode: Only ${ADMIN_EMAIL} can modify or delete records.`
      });
      setConfirmModalState({ isOpen: false });
      return;
    }

    const rowToDelete = confirmModalState.targetRow;
    if (!rowToDelete) {
      setConfirmModalState({ isOpen: false });
      return;
    }

    const previousDb = db;
    setDb((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      transactions: prev.transactions.filter((t) => t.id !== rowToDelete.id)
    }));

    setIsSyncingFirestore(true);
    try {
      await deleteTransactionFromFirestore(rowToDelete.id);
      setStatusBanner({
        type: 'info',
        message: `Deleted "${rowToDelete.description}" from Firebase Firestore.`
      });
    } catch (err: any) {
      setDb(previousDb);
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to delete transaction from Firestore.'
      });
    } finally {
      setIsSyncingFirestore(false);
      setConfirmModalState({ isOpen: false });
    }
  };

  const handleSaveEntry = async (
    entryData: Omit<EFundTransaction, 'id'>,
    existingId?: string,
    newMember?: string
  ) => {
    if (!canManage || !user) {
      setStatusBanner({
        type: 'error',
        message: `View-Only mode: Only ${ADMIN_EMAIL} can record or edit transactions.`
      });
      return;
    }

    setIsSavingEntry(true);
    setIsSyncingFirestore(true);

    const previousDb = db;
    const nextRowRef =
      db.transactions.reduce((max, t) => Math.max(max, t.rowRef || 92), 111) + 1;
    const assignedId = existingId || `row-${Date.now()}`;
    const updatedMembers =
      newMember && !db.members.includes(newMember)
        ? [...db.members, newMember]
        : db.members;

    // Optimistic local state update (reverted on Firestore failure)
    setDb((prev) => {
      if (existingId) {
        return {
          ...prev,
          lastUpdated: new Date().toISOString(),
          members: updatedMembers,
          transactions: prev.transactions.map((t) =>
            t.id === existingId ? { ...entryData, id: existingId } : t
          )
        };
      }

      const newTx: EFundTransaction = {
        ...entryData,
        id: assignedId,
        rowRef: nextRowRef
      };

      return {
        ...prev,
        lastUpdated: new Date().toISOString(),
        members: updatedMembers,
        transactions: [...prev.transactions, newTx]
      };
    });

    try {
      if (newMember && !db.members.includes(newMember)) {
        await updateLedgerConfigInFirestore({
          clanName: db.clanName,
          cashReserveTarget: db.cashReserveTarget ?? 15000,
          priorBalanceForward: db.priorBalanceForward,
          members: updatedMembers
        });
      }

      await saveTransactionToFirestore(
        user.uid,
        {
          ...entryData,
          rowRef: existingId ? entryData.rowRef : nextRowRef
        },
        existingId,
        nextRowRef,
        assignedId
      );

      setStatusBanner({
        type: 'success',
        message: existingId
          ? `Changes to "${entryData.description}" were successfully saved!`
          : `Transaction "${entryData.description}" was successfully recorded and saved!`
      });
      setIsEntryModalOpen(false);
      setEditingEntry(null);
    } catch (err: any) {
      setDb(previousDb);
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to save transaction to Firebase Firestore.'
      });
    } finally {
      setIsSavingEntry(false);
      setIsSyncingFirestore(false);
    }
  };

  const handleUpdatePriorBalanceForward = async (
    updatedPrior: ClanEFundDatabase['priorBalanceForward']
  ) => {
    if (!canManage || !user) return;

    const previousDb = db;
    setDb((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      priorBalanceForward: updatedPrior
    }));

    setIsSyncingFirestore(true);
    try {
      await updateLedgerConfigInFirestore({
        clanName: db.clanName,
        cashReserveTarget: db.cashReserveTarget ?? 15000,
        priorBalanceForward: updatedPrior,
        members: db.members
      });
      setStatusBanner({
        type: 'success',
        message: 'Opening balance forward successfully updated and saved to database!'
      });
    } catch (err: any) {
      setDb(previousDb);
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to update opening balance in Firestore.'
      });
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleUpdateCashReserveTarget = async (newTarget: number) => {
    if (!canManage || !user) return;
    const clampedTarget = Math.max(0, Math.min(500000, Math.round(newTarget)));
    const previousDb = db;

    setDb((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      cashReserveTarget: clampedTarget
    }));

    setIsSyncingFirestore(true);
    try {
      await updateLedgerConfigInFirestore({
        clanName: db.clanName,
        cashReserveTarget: clampedTarget,
        priorBalanceForward: db.priorBalanceForward,
        members: db.members
      });
      setStatusBanner({
        type: 'success',
        message: `Cash reserve target floor updated to ${formatPHP(clampedTarget)}!`
      });
    } catch (err: any) {
      setDb(previousDb);
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to update cash reserve target in Firestore.'
      });
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = EXPORT_JSON_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Date',
      'Description',
      'Category',
      'Member/Beneficiary',
      'Cash on Hand',
      'BPI Money Market Fund',
      'BPI Short Term',
      'Member Loans (Receivable)'
    ].map((h) => sanitizeCsvCell(h));

    const rows = db.transactions.map((t) => [
      sanitizeCsvCell(t.date),
      sanitizeCsvCell(t.description),
      sanitizeCsvCell(t.category),
      sanitizeCsvCell(t.memberOrBeneficiary),
      t.amountOnHand.toFixed(2),
      t.bpiMoneyMarket.toFixed(2),
      t.bpiShortTerm.toFixed(2),
      (t.memberLoan || 0).toFixed(2)
    ]);
    const currentTotals = calculateTotals(db);
    rows.push([
      '""',
      sanitizeCsvCell('Account Totals'),
      '""',
      '""',
      currentTotals.amountOnHand.toFixed(2),
      currentTotals.bpiMoneyMarket.toFixed(2),
      currentTotals.bpiShortTerm.toFixed(2),
      currentTotals.memberLoan.toFixed(2)
    ]);
    rows.push([
      '""',
      sanitizeCsvCell('Total Fund'),
      '""',
      '""',
      '',
      currentTotals.totalFund.toFixed(2),
      '',
      ''
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clan-efund-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManage || !user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_JSON_BYTES) {
      setStatusBanner({
        type: 'error',
        message: 'Import file exceeds the 5 MB safety limit.'
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const previousDb = db;
      try {
        const rawParsed = JSON.parse(String(ev.target?.result)) as Record<string, any>;
        if (!rawParsed || typeof rawParsed !== 'object') {
          throw new Error('Invalid Clan E-Fund JSON structure.');
        }

        // Support both standalone Clan E-Fund JSON and full Google Drive backup envelopes
        const ledgerSource =
          rawParsed.clanEFundLedger && typeof rawParsed.clanEFundLedger === 'object'
            ? rawParsed.clanEFundLedger
            : rawParsed;

        if (!Array.isArray(ledgerSource.transactions) || ledgerSource.transactions.length === 0) {
          throw new Error('Import file must contain a non-empty transactions array.');
        }
        if (ledgerSource.transactions.length > 5000) {
          throw new Error('Import file exceeds the maximum supported limit of 5,000 transactions.');
        }

        const seenIds = new Set<string>();
        const sanitizedTransactions: EFundTransaction[] = ledgerSource.transactions.map(
          (rawTx: any, idx: number) => {
            if (!rawTx || typeof rawTx !== 'object') {
              throw new Error(`Invalid transaction object at index ${idx}.`);
            }
            const rawDate = typeof rawTx.date === 'string' ? rawTx.date.trim() : '';
            const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '2026-01-01';
            const rawId =
              typeof rawTx.id === 'string' && rawTx.id.trim()
                ? sanitizeDocId(rawTx.id)
                : `row-import-${idx + 1}`;
            const uniqueId = seenIds.has(rawId) ? `${rawId}-${idx + 1}` : rawId;
            seenIds.add(uniqueId);

            const rawCat = String(rawTx.category || 'Contribution') as EntryCategory;
            const safeCategory: EntryCategory = VALID_IMPORT_CATEGORIES.has(rawCat)
              ? rawCat
              : 'Contribution';

            const safeDesc = String(rawTx.description || 'Imported Entry').trim().slice(0, 200);
            const safeMember = String(rawTx.memberOrBeneficiary || 'Clan Member')
              .trim()
              .slice(0, 80);
            const safeNotes =
              typeof rawTx.notes === 'string' && rawTx.notes.trim()
                ? rawTx.notes.trim().slice(0, 500)
                : undefined;

            return {
              id: uniqueId,
              rowRef:
                typeof rawTx.rowRef === 'number' && Number.isFinite(rawTx.rowRef)
                  ? Math.max(0, Math.round(rawTx.rowRef))
                  : idx + 1,
              date: safeDate,
              displayDate:
                typeof rawTx.displayDate === 'string' && rawTx.displayDate.trim()
                  ? rawTx.displayDate.trim().slice(0, 32)
                  : formatHumanDate(safeDate),
              description: safeDesc || 'Imported Entry',
              category: safeCategory,
              memberOrBeneficiary: safeMember || 'Clan Member',
              amountOnHand: clampNumber(rawTx.amountOnHand, -100_000_000, 100_000_000),
              bpiMoneyMarket: clampNumber(rawTx.bpiMoneyMarket, -100_000_000, 100_000_000),
              bpiShortTerm: clampNumber(rawTx.bpiShortTerm, -100_000_000, 100_000_000),
              memberLoan: clampNumber(rawTx.memberLoan, -100_000_000, 100_000_000),
              highlightAlert: Boolean(rawTx.highlightAlert),
              ...(safeNotes ? { notes: safeNotes } : {})
            };
          }
        );

        const rawPrior =
          ledgerSource.priorBalanceForward && typeof ledgerSource.priorBalanceForward === 'object'
            ? ledgerSource.priorBalanceForward
            : INITIAL_EFUND_DB.priorBalanceForward;

        const mergedDb: ClanEFundDatabase = {
          ...INITIAL_EFUND_DB,
          clanName:
            typeof ledgerSource.clanName === 'string' && ledgerSource.clanName.trim()
              ? ledgerSource.clanName.trim().slice(0, 120)
              : INITIAL_EFUND_DB.clanName,
          currency: 'PHP',
          cashReserveTarget: clampNumber(
            ledgerSource.cashReserveTarget ?? INITIAL_EFUND_DB.cashReserveTarget ?? 15000,
            0,
            500_000
          ),
          lastUpdated: new Date().toISOString(),
          members: sanitizeMembersList(ledgerSource.members),
          priorBalanceForward: {
            included: Boolean(rawPrior.included),
            label:
              typeof rawPrior.label === 'string' && rawPrior.label.trim()
                ? rawPrior.label.trim().slice(0, 120)
                : INITIAL_EFUND_DB.priorBalanceForward.label,
            date:
              typeof rawPrior.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawPrior.date.trim())
                ? rawPrior.date.trim()
                : INITIAL_EFUND_DB.priorBalanceForward.date,
            amountOnHand: clampNumber(rawPrior.amountOnHand, -100_000_000, 100_000_000),
            bpiMoneyMarket: clampNumber(rawPrior.bpiMoneyMarket, -100_000_000, 100_000_000),
            bpiShortTerm: clampNumber(rawPrior.bpiShortTerm, -100_000_000, 100_000_000),
            notes:
              typeof rawPrior.notes === 'string' ? rawPrior.notes.trim().slice(0, 500) : ''
          },
          transactions: sanitizedTransactions
        };

        setDb(mergedDb);
        setIsSyncingFirestore(true);
        await replaceEntireLedgerInFirestore(user.uid, mergedDb);

        let mamasImportedCount = 0;
        const rawMamas = rawParsed.mamasPersonalSavings;
        if (rawMamas && typeof rawMamas === 'object' && Array.isArray(rawMamas.records)) {
          const sanitizedMamasRecords: MamasSavingsEntry[] = rawMamas.records
            .slice(0, 2000)
            .filter((r: any) => r && typeof r === 'object')
            .map((r: any, idx: number) => {
              const rawDate = typeof r.date === 'string' ? r.date.trim() : '';
              const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '2026-01-01';
              return {
                id:
                  typeof r.id === 'string' && r.id.trim()
                    ? sanitizeDocId(r.id)
                    : `mamas-import-${idx + 1}`,
                rowRef:
                  typeof r.rowRef === 'number' && Number.isFinite(r.rowRef)
                    ? Math.max(0, Math.round(r.rowRef))
                    : idx + 1,
                date: safeDate,
                displayDate:
                  typeof r.displayDate === 'string' && r.displayDate.trim()
                    ? r.displayDate.trim().slice(0, 40)
                    : formatHumanDate(safeDate),
                invest: clampNumber(r.invest, -100_000_000, 100_000_000),
                mamaAtm: clampNumber(r.mamaAtm, -100_000_000, 100_000_000),
                ...(typeof r.customBucketId === 'string' && r.customBucketId.trim()
                  ? {
                      customBucketId: sanitizeDocId(r.customBucketId),
                      customAmount: clampNumber(r.customAmount, -100_000_000, 100_000_000)
                    }
                  : {}),
                ...(typeof r.notes === 'string' && r.notes.trim()
                  ? { notes: r.notes.trim().slice(0, 500) }
                  : {})
              };
            });

          const sanitizedMamas = calculateMamasTotals({
            title:
              typeof rawMamas.title === 'string' && rawMamas.title.trim()
                ? rawMamas.title.trim().slice(0, 120)
                : "Mama's Personal Savings",
            bucketLabels: normalizeMamasBucketLabels(rawMamas.bucketLabels),
            customBuckets: normalizeMamasCustomBuckets(rawMamas.customBuckets),
            investBalance: 0,
            mamaAtmBalance: 0,
            loanToMhariz: 0,
            totalSavings: 0,
            records: sanitizedMamasRecords
          });

          setMamasState(sanitizedMamas);
          await saveMamasSavingsToFirestore(user.uid, sanitizedMamas);
          mamasImportedCount = sanitizedMamasRecords.length;
        }

        setIsSyncingFirestore(false);
        setStatusBanner({
          type: 'success',
          message:
            mamasImportedCount > 0
              ? `Imported ${sanitizedTransactions.length} E-Fund records and ${mamasImportedCount} Mama's Savings records from ${file.name}.`
              : `Imported ${sanitizedTransactions.length} sanitized records from ${file.name} and synced to Firebase Firestore.`
        });
      } catch (err: any) {
        setDb(previousDb);
        setIsSyncingFirestore(false);
        setStatusBanner({
          type: 'error',
          message: err?.message || 'Failed to parse or import JSON file.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totals = useMemo(() => calculateTotals(db), [db]);

  // Compute running balance per row in true chronological order (date first, rowRef second)
  const rowsWithRunningTotals = useMemo(() => {
    let runningOnHand = db.priorBalanceForward.included ? db.priorBalanceForward.amountOnHand : 0;
    let runningMMF = db.priorBalanceForward.included ? db.priorBalanceForward.bpiMoneyMarket : 0;
    let runningShortTerm = db.priorBalanceForward.included ? db.priorBalanceForward.bpiShortTerm : 0;
    let runningMemberLoan = 0;

    const sortedChronological = [...db.transactions].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.rowRef ?? 999999) - (b.rowRef ?? 999999);
    });

    return sortedChronological.map((tx) => {
      runningOnHand = Number((runningOnHand + tx.amountOnHand).toFixed(2));
      runningMMF = Number((runningMMF + tx.bpiMoneyMarket).toFixed(2));
      runningShortTerm = Number((runningShortTerm + tx.bpiShortTerm).toFixed(2));
      runningMemberLoan = Number((runningMemberLoan + (tx.memberLoan || 0)).toFixed(2));
      const runningTotalFund = Number(
        (runningOnHand + runningMMF + runningShortTerm + runningMemberLoan).toFixed(2)
      );
      return {
        ...tx,
        runningOnHand,
        runningMMF,
        runningShortTerm,
        runningMemberLoan,
        runningTotalFund
      };
    });
  }, [db]);

  const availableYears = useMemo(() => {
    const years = new Set<string>(['2026', '2025', '2024']);
    for (const tx of db.transactions) {
      if (tx.date && tx.date.length >= 4) {
        years.add(tx.date.slice(0, 4));
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [db.transactions]);

  const yearRowCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of db.transactions) {
      const y = tx.date.slice(0, 4);
      counts[y] = (counts[y] || 0) + 1;
    }
    return counts;
  }, [db.transactions]);

  const filteredRows = useMemo(() => {
    const matches = rowsWithRunningTotals.filter((tx) => {
      if (filterTab === 'money_in') {
        if (
          tx.category !== 'Contribution' &&
          tx.category !== 'Reimbursement' &&
          tx.category !== 'Investment Yield' &&
          tx.category !== 'Loan Repayment'
        ) {
          return false;
        }
      } else if (filterTab === 'loans') {
        if (tx.category !== 'Member Loan' && tx.category !== 'Loan Repayment') {
          return false;
        }
      } else if (filterTab !== 'all' && tx.category !== filterTab) {
        return false;
      }
      if (memberFilter !== 'ALL' && tx.memberOrBeneficiary !== memberFilter) return false;
      if (accountFilter === 'amountOnHand' && tx.amountOnHand === 0) return false;
      if (accountFilter === 'bpiMoneyMarket' && tx.bpiMoneyMarket === 0) return false;
      if (accountFilter === 'bpiShortTerm' && tx.bpiShortTerm === 0) return false;
      if (accountFilter === 'memberLoan' && (tx.memberLoan || 0) === 0) return false;
      if (yearFilter !== 'ALL' && !tx.date.startsWith(`${yearFilter}-`)) return false;
      if (monthFilter !== 'ALL' && tx.date.slice(5, 7) !== monthFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesDate = tx.displayDate.toLowerCase().includes(q) || tx.date.includes(q);
        const matchesMember = tx.memberOrBeneficiary.toLowerCase().includes(q);
        const matchesNotes = (tx.notes || '').toLowerCase().includes(q);
        return matchesDesc || matchesDate || matchesMember || matchesNotes;
      }
      return true;
    });

    if (sortOrder === 'newest_desc') {
      return [...matches].reverse();
    }
    return matches;
  }, [
    rowsWithRunningTotals,
    filterTab,
    accountFilter,
    memberFilter,
    yearFilter,
    monthFilter,
    searchQuery,
    sortOrder
  ]);

  const filteredSummary = useMemo(() => {
    let inflows = 0;
    let outflows = 0;
    let net = 0;
    for (const tx of filteredRows) {
      const cashAndBankDelta = tx.amountOnHand + tx.bpiMoneyMarket + tx.bpiShortTerm;
      if (tx.category === 'Internal Transfer') {
        continue;
      }
      if (tx.category === 'Member Loan') {
        const lent = Math.abs(tx.memberLoan || cashAndBankDelta);
        outflows += lent;
        net -= lent;
      } else if (tx.category === 'Loan Repayment') {
        const repaid = Math.abs(tx.memberLoan || cashAndBankDelta);
        inflows += repaid;
        net += repaid;
      } else {
        const delta = cashAndBankDelta + (tx.memberLoan || 0);
        if (delta > 0) inflows += delta;
        if (delta < 0) outflows += Math.abs(delta);
        net += delta;
      }
    }
    return { inflows, outflows, net, count: filteredRows.length };
  }, [filteredRows]);

  // Reset Activity Ledger page to 1 when filters/search/sort change
  useEffect(() => {
    setLedgerPage(1);
  }, [
    filterTab,
    accountFilter,
    memberFilter,
    yearFilter,
    monthFilter,
    searchQuery,
    sortOrder
  ]);

  const paginatedLedgerRows = useMemo(() => {
    if (ledgerPageSize <= 0) return filteredRows;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / ledgerPageSize));
    const safePage = Math.min(Math.max(1, ledgerPage), totalPages);
    const start = (safePage - 1) * ledgerPageSize;
    return filteredRows.slice(start, start + ledgerPageSize);
  }, [filteredRows, ledgerPage, ledgerPageSize]);

  // Contributor summaries
  const contributorStats = useMemo(() => {
    const map = new Map<
      string,
      {
        member: string;
        cashContributed: number;
        mmfContributed: number;
        shortTermContributed: number;
        totalContributed: number;
        count: number;
        lastDate: string;
        monthlyByMonth: Record<string, number>;
      }
    >();

    for (const m of db.members) {
      map.set(m, {
        member: m,
        cashContributed: 0,
        mmfContributed: 0,
        shortTermContributed: 0,
        totalContributed: 0,
        count: 0,
        lastDate: '—',
        monthlyByMonth: {}
      });
    }

    for (const tx of db.transactions) {
      if (tx.category === 'Contribution') {
        const key = tx.memberOrBeneficiary;
        const current = map.get(key) || {
          member: key,
          cashContributed: 0,
          mmfContributed: 0,
          shortTermContributed: 0,
          totalContributed: 0,
          count: 0,
          lastDate: '—',
          monthlyByMonth: {}
        };
        const cashPos = Math.max(0, tx.amountOnHand);
        const mmfPos = Math.max(0, tx.bpiMoneyMarket);
        const stPos = Math.max(0, tx.bpiShortTerm);
        const rowSum = cashPos + mmfPos + stPos;

        current.cashContributed += cashPos;
        current.mmfContributed += mmfPos;
        current.shortTermContributed += stPos;
        current.totalContributed += rowSum;
        current.count += 1;
        current.lastDate = formatHumanDate(tx.date);

        const monthKey = tx.date.slice(0, 7);
        current.monthlyByMonth[monthKey] = (current.monthlyByMonth[monthKey] || 0) + rowSum;

        map.set(key, current);
      }
    }

    return Array.from(map.values())
      .filter((c) => c.totalContributed > 0)
      .sort((a, b) => b.totalContributed - a.totalContributed);
  }, [db]);

  const paginatedMatrixContributors = useMemo(() => {
    if (matrixPageSize <= 0) return contributorStats;
    const totalPages = Math.max(1, Math.ceil(contributorStats.length / matrixPageSize));
    const safePage = Math.min(Math.max(1, matrixPage), totalPages);
    const start = (safePage - 1) * matrixPageSize;
    return contributorStats.slice(start, start + matrixPageSize);
  }, [contributorStats, matrixPage, matrixPageSize]);

  const medicalRows = useMemo(
    () =>
      [...rowsWithRunningTotals]
        .filter((t) => t.category === 'Medical Disbursement' || t.category === 'Reimbursement')
        .reverse(),
    [rowsWithRunningTotals]
  );

  const paginatedMedicalRows = useMemo(() => {
    if (medicalPageSize <= 0) return medicalRows;
    const totalPages = Math.max(1, Math.ceil(medicalRows.length / medicalPageSize));
    const safePage = Math.min(Math.max(1, medicalPage), totalPages);
    const start = (safePage - 1) * medicalPageSize;
    return medicalRows.slice(start, start + medicalPageSize);
  }, [medicalRows, medicalPage, medicalPageSize]);

  const transferRows = useMemo(
    () =>
      [...rowsWithRunningTotals]
        .filter((t) => t.category === 'Internal Transfer' || t.category === 'Investment Yield')
        .reverse(),
    [rowsWithRunningTotals]
  );

  const paginatedTransferRows = useMemo(() => {
    if (transferPageSize <= 0) return transferRows;
    const totalPages = Math.max(1, Math.ceil(transferRows.length / transferPageSize));
    const safePage = Math.min(Math.max(1, transferPage), totalPages);
    const start = (safePage - 1) * transferPageSize;
    return transferRows.slice(start, start + transferPageSize);
  }, [transferRows, transferPage, transferPageSize]);

  const totalContributionsOnly = useMemo(
    () =>
      db.transactions
        .filter((t) => t.category === 'Contribution')
        .reduce(
          (acc, t) =>
            acc +
            Math.max(0, t.amountOnHand) +
            Math.max(0, t.bpiMoneyMarket) +
            Math.max(0, t.bpiShortTerm),
          0
        ),
    [db]
  );

  const grossMedicalOutflow = useMemo(
    () =>
      db.transactions
        .filter((t) => t.category === 'Medical Disbursement')
        .reduce(
          (acc, t) => acc + Math.abs(t.amountOnHand + t.bpiMoneyMarket + t.bpiShortTerm),
          0
        ),
    [db]
  );

  const medicalEventCount = useMemo(
    () => db.transactions.filter((t) => t.category === 'Medical Disbursement').length,
    [db]
  );

  const avgMedicalIncident = useMemo(
    () => (medicalEventCount > 0 ? grossMedicalOutflow / medicalEventCount : 2500),
    [grossMedicalOutflow, medicalEventCount]
  );

  const totalReimbursements = useMemo(
    () =>
      db.transactions
        .filter((t) => t.category === 'Reimbursement')
        .reduce(
          (acc, t) => acc + Math.max(0, t.amountOnHand + t.bpiMoneyMarket + t.bpiShortTerm),
          0
        ),
    [db]
  );

  const totalInvestedFunds = totals.bpiMoneyMarket + totals.bpiShortTerm;
  const priorTotalForward = db.priorBalanceForward.included
    ? db.priorBalanceForward.amountOnHand +
      db.priorBalanceForward.bpiMoneyMarket +
      db.priorBalanceForward.bpiShortTerm
    : 0;

  const openNewEntryModal = (
    mode: EntryPresetMode = 'contribution',
    member: string | null = null,
    targetDate: string | null = null
  ) => {
    if (!canManage) return;
    setEditingEntry(null);
    setPresetMode(mode);
    setPresetMember(member);
    setPresetDate(targetDate);
    setIsEntryModalOpen(true);
  };

  const cashPct = totals.totalFund > 0 ? (totals.amountOnHand / totals.totalFund) * 100 : 0;
  const mmfPct = totals.totalFund > 0 ? (totals.bpiMoneyMarket / totals.totalFund) * 100 : 0;
  const stPct = totals.totalFund > 0 ? (totals.bpiShortTerm / totals.totalFund) * 100 : 0;
  const loanPct = totals.totalFund > 0 ? (totals.memberLoan / totals.totalFund) * 100 : 0;
  const cashReserveTarget = db.cashReserveTarget || 15000;
  const emergencyVisitsCovered =
    avgMedicalIncident > 0 ? totals.amountOnHand / avgMedicalIncident : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-2 sm:gap-8 px-3 py-2.5 sm:px-6 sm:py-4 bg-white border-b border-slate-200 sticky top-0 z-30 w-full min-w-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveAccount('clan_efund');
            setActiveSection('dashboard');
          }}
          className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate"
        >
          Clan E-Fund
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveAccount('clan_efund');
              setActiveSection('dashboard');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeAccount === 'clan_efund' && activeSection === 'dashboard'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Dashboard
          </a>
          <a
            href="#ledger"
            onClick={(e) => {
              e.preventDefault();
              setActiveAccount('clan_efund');
              setActiveSection('ledger');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeAccount === 'clan_efund' && activeSection === 'ledger'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Activity
          </a>
          <a
            href="#contributors"
            onClick={(e) => {
              e.preventDefault();
              setActiveAccount('clan_efund');
              setActiveSection('contributors');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeAccount === 'clan_efund' && activeSection === 'contributors'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Contributors
          </a>
          <a
            href="#medical"
            onClick={(e) => {
              e.preventDefault();
              setActiveAccount('clan_efund');
              setActiveSection('medical');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeAccount === 'clan_efund' && activeSection === 'medical'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Medical &amp; Investments
          </a>
          {canManage && (
            <a
              href="#database"
              onClick={(e) => {
                e.preventDefault();
                setActiveAccount('clan_efund');
                setActiveSection('database');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
                activeAccount === 'clan_efund' && activeSection === 'database'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Firestore DB
            </a>
          )}
          <a
            href="#help"
            onClick={(e) => {
              e.preventDefault();
              setActiveAccount('clan_efund');
              setActiveSection('help');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeAccount === 'clan_efund' && activeSection === 'help'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Help Guide
          </a>
        </nav>

        {/* Zone 3: Max 2 controls (Auth action + Primary CTA) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {!user ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              {isSigningIn ? 'Signing in...' : (
                <>
                  <span className="hidden sm:inline">Manager </span>Sign In
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              title={user.email || 'Signed in'}
              className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          )}

          {canManage ? (
            <button
              type="button"
              onClick={() => openNewEntryModal('contribution')}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 sm:gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Record Transaction</span>
              <span className="sm:hidden">Record</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 sm:gap-1.5 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}
        </div>
      </header>

      {/* Top Account Switcher (Visible only to Manager) */}
      {canManage && (
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 sm:px-6 w-full">
          <div className="mx-auto max-w-[1280px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Account:
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/80 p-0.5 text-xs font-medium w-full sm:w-auto sm:inline-flex min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveAccount('clan_efund')}
                  className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 rounded-md transition-all text-center min-w-0 ${
                    activeAccount === 'clan_efund'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Clan E-Fund</span>
                  <span className="font-mono text-[10px] sm:text-[11px] text-slate-500 font-normal shrink-0">
                    ({formatPHP(totals.totalFund)})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAccount('mamas_savings')}
                  className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 rounded-md transition-all text-center min-w-0 ${
                    activeAccount === 'mamas_savings'
                      ? 'bg-purple-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-purple-900 font-medium'
                  }`}
                  title="Switch to Mama's Personal Savings"
                >
                  <PiggyBank className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Mama&apos;s Savings</span>
                  <span
                    className={`font-mono text-[10px] sm:text-[11px] shrink-0 ${
                      activeAccount === 'mamas_savings' ? 'text-purple-200' : 'text-slate-500'
                    }`}
                  >
                    ({formatPHP(mamasState.totalSavings)})
                  </span>
                </button>
              </div>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
              {activeAccount === 'clan_efund' ? (
                <span>Shared Clan Fund · 8 Members · Parents Medical</span>
              ) : (
                <span className="text-purple-900 font-medium truncate">
                  Mama&apos;s Personal Account · Strictly Managed by Jonathan ({ADMIN_EMAIL})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container with safe bottom padding for mobile navigation */}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 py-3.5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6 pb-24 sm:pb-28 md:pb-8 min-w-0 overflow-x-hidden">
        {/* Status Notification Banner (Fixed Top Floating Toast on Mobile & Desktop) */}
        {statusBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92vw] sm:w-auto max-w-lg shadow-2xl transition-all duration-300 pointer-events-auto">
            <div
              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-xl backdrop-blur-md ${
                statusBanner.type === 'success'
                  ? 'border-emerald-300 bg-emerald-900/95 text-emerald-50 shadow-emerald-950/20'
                  : statusBanner.type === 'error'
                  ? 'border-red-300 bg-red-900/95 text-red-50 shadow-red-950/20'
                  : 'border-slate-300 bg-slate-900/95 text-slate-100 shadow-slate-950/20'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {statusBanner.type === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                )}
                <span className="leading-snug">{statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-xs font-semibold px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white shrink-0 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Account View Routing: Mama's Personal Savings vs Clan Emergency Fund */}
        {activeAccount === 'mamas_savings' ? (
          <MamasSavingsView
            state={mamasState}
            canManage={canManage}
            onUpdateState={handleUpdateMamasSavings}
            isSyncing={isSyncingFirestore}
            userEmail={user?.email}
            onGoogleSignIn={handleGoogleLogin}
            onReturnToClan={() => setActiveAccount('clan_efund')}
          />
        ) : (
          <>
            {/* SECTION 0: DEDICATED DASHBOARD PAGE (COMMON SUMMARY CARDS & OVERVIEW) */}
            {activeSection === 'dashboard' && (
              <section className="space-y-6">
            {/* 4 Core Pillars of the Parents' Emergency Fund (Total Remaining, Contributions, Medical Disbursements, Investments) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setAccountFilter('ALL');
                  setFilterTab('all');
                  setActiveSection('ledger');
                }}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Total Fund Remaining
                  </span>
                  <span className="text-xs text-slate-400">All 4 Accounts →</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                  {formatPHP(totals.totalFund)}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Cash {formatPHP(totals.amountOnHand)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Invested {formatPHP(totalInvestedFunds)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('contributors')}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Clan Contributions (2024–2026)
                  </span>
                  <span className="text-xs text-slate-400">{db.members.length} members →</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  +{formatPHP(totalContributionsOnly)}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{contributorStats.length} active contributors</span>
                  {priorTotalForward > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>+{formatPHP(priorTotalForward)} prior bal</span>
                    </>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('medical')}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Parents&apos; Medical Outflow
                  </span>
                  <span className="text-xs text-slate-400">{medicalEventCount} visits →</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-600">
                  -{formatPHP(grossMedicalOutflow)}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>
                    Net -{formatPHP(Math.max(0, grossMedicalOutflow - totalReimbursements))}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>+{formatPHP(totalReimbursements)} reimbursed</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('medical')}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Invested Bank Reserves
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {(mmfPct + stPct).toFixed(1)}% →
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatPHP(totalInvestedFunds)}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>MMF {formatPHP(totals.bpiMoneyMarket)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Short Term {formatPHP(totals.bpiShortTerm)}</span>
                </div>
              </button>
            </div>

            {/* 4-Account Custody Breakdown (Immediate Buffer, Bank MMF, Short Term, Member Loans) */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 lg:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <button
                  type="button"
                  onClick={() => {
                    setAccountFilter('amountOnHand');
                    setActiveSection('ledger');
                  }}
                  className="p-5 text-left transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Cash on Hand (Buffer)
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {cashPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatPHP(totals.amountOnHand)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>Covers ~{emergencyVisitsCovered.toFixed(1)}x medical visits</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        totals.amountOnHand < cashReserveTarget
                          ? 'text-amber-700 font-semibold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {totals.amountOnHand < cashReserveTarget
                        ? `${formatPHP(cashReserveTarget - totals.amountOnHand)} below floor`
                        : `Above floor`}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountFilter('bpiMoneyMarket');
                    setActiveSection('ledger');
                  }}
                  className="p-5 text-left transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Money Market Fund</span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {mmfPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatPHP(totals.bpiMoneyMarket)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Primary yield reserve</span>
                    <span aria-hidden="true">·</span>
                    <span>T+1 liquidity</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountFilter('bpiShortTerm');
                    setActiveSection('ledger');
                  }}
                  className="p-5 text-left transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Short Term Fund</span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {stPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatPHP(totals.bpiShortTerm)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Secondary bank UITF</span>
                    <span aria-hidden="true">·</span>
                    <span>Capital preservation</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountFilter('memberLoan');
                    setActiveSection('ledger');
                  }}
                  className="p-5 text-left transition-colors hover:bg-amber-50/40 bg-amber-50/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
                      <HandCoins className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                      <span>Member Loans (Receivable)</span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-amber-700 font-semibold">
                      {loanPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-900">
                    {formatPHP(totals.memberLoan)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-800">
                    <span>Lent to clan members</span>
                    <span aria-hidden="true">·</span>
                    <span>Repayments collected</span>
                  </div>
                </button>
              </div>

              {/* Proportional Capital Allocation Bar & Admin Quick Log */}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      style={{ width: `${Math.max(0, Math.min(100, cashPct))}%` }}
                      className="bg-amber-600 transition-all"
                      title={`Cash on Hand: ${formatPHP(totals.amountOnHand)}`}
                    />
                    <div
                      style={{ width: `${Math.max(0, Math.min(100, mmfPct))}%` }}
                      className="bg-slate-900 transition-all"
                      title={`Money Market Fund: ${formatPHP(totals.bpiMoneyMarket)}`}
                    />
                    <div
                      style={{ width: `${Math.max(0, Math.min(100, stPct))}%` }}
                      className="bg-emerald-600 transition-all"
                      title={`Short Term Fund: ${formatPHP(totals.bpiShortTerm)}`}
                    />
                    <div
                      style={{ width: `${Math.max(0, Math.min(100, loanPct))}%` }}
                      className="bg-blue-600 transition-all"
                      title={`Member Loans: ${formatPHP(totals.memberLoan)}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Liquid Cash:{' '}
                      <strong className="font-mono tabular-nums text-slate-900">
                        {cashPct.toFixed(1)}%
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Money Market:{' '}
                      <strong className="font-mono tabular-nums text-slate-900">
                        {mmfPct.toFixed(1)}%
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Short Term:{' '}
                      <strong className="font-mono tabular-nums text-slate-900">
                        {stPct.toFixed(1)}%
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Member Loans:{' '}
                      <strong className="font-mono tabular-nums text-amber-900">
                        {loanPct.toFixed(1)}%
                      </strong>
                    </span>
                  </div>
                </div>

                {canManage ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                    <span className="text-xs font-semibold text-slate-500 sm:mr-1">Quick Log:</span>
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('contribution')}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 text-center active:scale-95 transition-all"
                      >
                        + Contribution
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('loan_repayment')}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-center active:scale-95 transition-all"
                      >
                        + Collect Loan
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('medical', 'Papa')}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 text-center active:scale-95 transition-all"
                      >
                        - Medical
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 shrink-0">
                    Parents&apos; Emergency Fund · View-Only Contributor Mode
                  </div>
                )}
              </div>
            </div>

            {/* Dashboard Overview Grid: Recent Transactions + Contributors & Medical Reserve Snapshot */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 7 Cols: Recent Activity Snapshot */}
              <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
                      <p className="text-xs text-slate-500">
                        Latest 5 movements across Cash on Hand, Money Market, and Short Term funds
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountFilter('ALL');
                        setFilterTab('all');
                        setActiveSection('ledger');
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
                    >
                      View all {db.transactions.length} entries →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {[...rowsWithRunningTotals]
                      .reverse()
                      .slice(0, 5)
                      .map((tx) => {
                        const pres = resolveTransactionPresentation(tx);
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {pres.displayTitle}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span className="font-mono tabular-nums">
                                  {formatHumanDate(tx.date)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    tx.highlightAlert ? 'font-medium text-red-600' : undefined
                                  }
                                >
                                  {tx.category}
                                </span>
                                {pres.showMemberBadge && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-slate-700">
                                      {tx.memberOrBeneficiary}
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>{pres.accountSummaryLabel}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${
                                  pres.isInternalTransfer
                                    ? 'text-slate-800'
                                    : tx.category === 'Member Loan'
                                    ? 'text-amber-800'
                                    : pres.primaryAmount > 0
                                    ? 'text-emerald-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {pres.isInternalTransfer
                                  ? `${formatPHP(pres.primaryAmount)} Transfer`
                                  : tx.category === 'Member Loan'
                                  ? `${formatPHP(pres.primaryAmount)} Lent`
                                  : pres.primaryAmount > 0
                                  ? `+${formatPHP(pres.primaryAmount)}`
                                  : formatPHP(pres.primaryAmount)}
                              </div>
                              <div className="text-xs font-mono tabular-nums text-slate-400">
                                Bal: {formatPHP(tx.runningTotalFund)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Opening Balance Forward:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatPHP(
                        db.priorBalanceForward.amountOnHand +
                          db.priorBalanceForward.bpiMoneyMarket +
                          db.priorBalanceForward.bpiShortTerm
                      )}
                    </strong>
                  </span>
                  <span className="text-slate-400">Prior to Apr 27, 2026</span>
                </div>
              </div>

              {/* Right 5 Cols: Contributor Standings & Medical / Investment Health */}
              <div className="lg:col-span-5 space-y-6">
                {/* Contributor Standings Card */}
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Contributor Standings</h2>
                      <p className="text-xs text-slate-500">Jan 2024 – Present cumulative inflows</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('contributors')}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
                    >
                      Cadence Matrix →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {contributorStats.map((stat) => (
                      <div
                        key={stat.member}
                        className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{stat.member}</div>
                          <div className="text-xs text-slate-500">
                            {stat.count} contributions · Last {stat.lastDate}
                          </div>
                        </div>
                        <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                          {formatPHP(stat.totalContributed)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parents' Emergency Readiness & Cash Reserve Target Card */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Parents&apos; Emergency Readiness
                      </h2>
                      <p className="text-xs text-slate-500">
                        Immediate liquid cash coverage for check-ups, labs, and medicines
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('medical')}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
                    >
                      Medical Log →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-500">Avg Cost per Medical Visit</div>
                      <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatPHP(avgMedicalIncident)}
                      </div>
                      <div className="mt-0.5 text-slate-400">
                        Cash covers ~{emergencyVisitsCovered.toFixed(1)} visits
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-slate-500">Target Liquid Cash Floor</div>
                      <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatPHP(cashReserveTarget)}
                      </div>
                      <div
                        className={`mt-0.5 font-medium ${
                          totals.amountOnHand < cashReserveTarget
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {totals.amountOnHand < cashReserveTarget
                          ? `Short by ${formatPHP(cashReserveTarget - totals.amountOnHand)}`
                          : 'Healthy liquid buffer'}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Floor Target:</span>
                        {[10000, 15000, 20000].map((targetVal) => (
                          <button
                            key={targetVal}
                            type="button"
                            onClick={() => handleUpdateCashReserveTarget(targetVal)}
                            className={`rounded border px-2 py-1 font-mono tabular-nums transition-colors ${
                              cashReserveTarget === targetVal
                                ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            ₱{(targetVal / 1000).toFixed(0)}k
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 1: MODERN TREASURY ACTIVITY STREAM (NO SPREADSHEET CLUTTER) */}
        {activeSection === 'ledger' && (
          <ActivityLedgerView
            db={db}
            totals={totals}
            canManage={canManage}
            filterTab={filterTab}
            onFilterTabChange={setFilterTab}
            accountFilter={accountFilter}
            onAccountFilterChange={setAccountFilter}
            memberFilter={memberFilter}
            onMemberFilterChange={setMemberFilter}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sortOrder={sortOrder}
            onToggleSortOrder={() =>
              setSortOrder((prev) => (prev === 'newest_desc' ? 'oldest_asc' : 'newest_desc'))
            }
            showPriorBalanceConfig={showPriorBalanceConfig}
            onTogglePriorBalanceConfig={() => setShowPriorBalanceConfig((v) => !v)}
            availableYears={availableYears}
            yearRowCounts={yearRowCounts}
            monthOptions={LEDGER_MONTH_OPTIONS}
            filteredRowsCount={filteredRows.length}
            filteredSummary={filteredSummary}
            paginatedRows={paginatedLedgerRows}
            ledgerPage={ledgerPage}
            ledgerPageSize={ledgerPageSize}
            onLedgerPageChange={setLedgerPage}
            onLedgerPageSizeChange={setLedgerPageSize}
            formatHumanDate={formatHumanDate}
            resolveTransactionPresentation={resolveTransactionPresentation}
            onUpdatePriorBalanceForward={handleUpdatePriorBalanceForward}
            onDownloadCsv={handleDownloadCsv}
            onEditTransaction={(tx) => {
              setEditingEntry(tx);
              setIsEntryModalOpen(true);
            }}
            onRequestDeleteTransaction={(tx) =>
              setConfirmModalState({
                isOpen: true,
                targetRow: tx
              })
            }
            onOpenNewEntry={() => openNewEntryModal('contribution')}
          />
        )}

        {/* SECTION 2: CLAN CONTRIBUTORS + MONTHLY CADENCE CARDS & MATRIX */}
        {activeSection === 'contributors' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Clan Contributors & Monthly Cadence
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Member contribution cards and 2026 monthly consistency tracker
                </p>
              </div>
            </div>

            {/* Member Profile Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contributorStats.map((stat) => (
                <div
                  key={stat.member}
                  className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900">{stat.member}</h3>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {stat.count} entries
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                      {formatPHP(stat.totalContributed)}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>To Cash on Hand</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatPHP(stat.cashContributed)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>To BPI Money Market</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatPHP(stat.mmfContributed)}
                        </span>
                      </div>
                      {stat.shortTermContributed > 0 && (
                        <div className="flex justify-between">
                          <span>To BPI Short Term</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            {formatPHP(stat.shortTermContributed)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">Last: {stat.lastDate}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('contribution', stat.member)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        + Log
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly Contribution Cadence Matrix (Multi-Year: 2026, 2025, 2024) */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Monthly Contribution Tracker ({selectedMatrixYear})
                  </h2>
                  <p className="text-xs text-slate-500">
                    {canManage
                      ? 'Click any unrecorded month cell (+ Log) to record that member’s contribution for that month'
                      : 'Monthly contribution breakdown across Clan E-Fund members'}
                  </p>
                </div>
                {/* Year Selector Tabs */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200 shrink-0">
                  {MATRIX_YEARS.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedMatrixYear(yr)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        selectedMatrixYear === yr
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                <div className="sm:hidden px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Swipe horizontally to view all months →</span>
                  <span className="font-mono text-slate-400">{selectedMatrixYear}</span>
                </div>
                {(() => {
                  const activeMonths = MATRIX_MONTHS_BY_YEAR[selectedMatrixYear];
                  return (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="px-4 py-3">Clan Member</th>
                          {activeMonths.map((m) => (
                            <th key={m.key} className="px-3 py-3 text-right whitespace-nowrap">
                              {m.label}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right">{selectedMatrixYear} Total</th>
                          <th className="px-4 py-3 text-right bg-slate-100/60">All-Time Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {paginatedMatrixContributors.map((stat) => {
                          const yearSum = activeMonths.reduce(
                            (acc, m) => acc + (stat.monthlyByMonth[m.key] || 0),
                            0
                          );
                          return (
                            <tr key={stat.member} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                {stat.member}
                              </td>
                              {activeMonths.map((m) => {
                                const amt = stat.monthlyByMonth[m.key] || 0;
                                return (
                                  <td
                                    key={m.key}
                                    className="px-3 py-3 text-right font-mono tabular-nums text-xs whitespace-nowrap"
                                  >
                                    {amt > 0 ? (
                                      <span className="font-semibold text-emerald-700">
                                        {formatPHP(amt)}
                                      </span>
                                    ) : canManage ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openNewEntryModal('contribution', stat.member, m.defaultDate)
                                        }
                                        className="text-slate-400 hover:text-slate-900 hover:underline"
                                        title={`Log ${stat.member}'s contribution for ${m.label}`}
                                      >
                                        + Log
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                {formatPHP(yearSum)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-800 bg-slate-50/70 whitespace-nowrap">
                                {formatPHP(stat.totalContributed)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
              <PaginationBar
                currentPage={matrixPage}
                totalItems={contributorStats.length}
                pageSize={matrixPageSize}
                onPageChange={setMatrixPage}
                onPageSizeChange={setMatrixPageSize}
                pageSizeOptions={[4, 8, 12]}
                itemLabel="contributors"
              />
            </div>
          </section>
        )}

        {/* SECTION 3: MEDICAL DISBURSEMENTS & BANK INVESTMENT TRANSFERS */}
        {activeSection === 'medical' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-xs font-medium text-slate-500">
                  Parents&apos; Gross Medical Outflow
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-600">
                  -{formatPHP(grossMedicalOutflow)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Across {medicalEventCount} medical visits
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-xs font-medium text-slate-500">
                  Average Cost per Medical Visit
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatPHP(avgMedicalIncident)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Cash covers ~{emergencyVisitsCovered.toFixed(1)} visits
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-xs font-medium text-slate-500">
                  Emergency Reimbursements
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                  +{formatPHP(totalReimbursements)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Net Medical Draw: -{formatPHP(Math.max(0, grossMedicalOutflow - totalReimbursements))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-xs font-medium text-slate-500">
                  Total Invested in Bank Funds
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatPHP(totalInvestedFunds)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  MMF {formatPHP(totals.bpiMoneyMarket)} · ST {formatPHP(totals.bpiShortTerm)}
                </div>
              </div>
            </div>

            {/* Medical Disbursements List */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Parents&apos; Medical Disbursements &amp; Reimbursements
                  </h2>
                  <p className="text-xs text-slate-500">
                    Chronological log of check-ups, diagnostic tests, medications, and reimbursements
                  </p>
                </div>
                {canManage && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => openNewEntryModal('reimbursement', 'Dondon')}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 text-center whitespace-nowrap active:scale-95"
                    >
                      + Reimbursement
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewEntryModal('medical', 'Papa')}
                      className="rounded-md bg-slate-900 px-3 py-2.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white hover:bg-slate-800 text-center whitespace-nowrap active:scale-95"
                    >
                      + Medical Expense
                    </button>
                  </div>
                )}
              </div>
              <div className="divide-y divide-slate-200">
                {paginatedMedicalRows.map((row) => {
                  const pres = resolveTransactionPresentation(row);
                  return (
                    <div
                      key={row.id}
                      className="p-4 sm:px-5 sm:py-3.5 hover:bg-slate-50 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 leading-snug">
                              {pres.displayTitle}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <span className="font-mono tabular-nums">{formatHumanDate(row.date)}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                row.highlightAlert ? 'font-medium text-red-600' : undefined
                              }
                            >
                              {row.category}
                            </span>
                            {pres.showMemberBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-slate-700">
                                  {row.memberOrBeneficiary}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{pres.accountSummaryLabel}</span>
                            {pres.cleanNote && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-400 truncate max-w-[200px]">
                                  {pres.cleanNote}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-base font-mono tabular-nums font-bold ${
                              pres.primaryAmount < 0 ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {pres.primaryAmount > 0
                              ? `+${formatPHP(pres.primaryAmount)}`
                              : formatPHP(pres.primaryAmount)}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEntry(row);
                              setIsEntryModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:p-1.5 rounded-md text-xs font-medium text-slate-700 sm:text-slate-400 bg-slate-100 sm:bg-transparent hover:bg-slate-200/70 hover:text-slate-900 min-h-[38px] sm:min-h-0"
                            title="Edit entry"
                            aria-label={`Edit ${row.description}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sm:hidden">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModalState({
                                isOpen: true,
                                targetRow: row
                              })
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:p-1.5 rounded-md text-xs font-medium text-red-600 sm:text-slate-400 bg-red-50 sm:bg-transparent hover:bg-red-100 sm:hover:bg-red-50 hover:text-red-700 min-h-[38px] sm:min-h-0"
                            title="Delete entry"
                            aria-label={`Delete ${row.description}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sm:hidden">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <PaginationBar
                currentPage={medicalPage}
                totalItems={medicalRows.length}
                pageSize={medicalPageSize}
                onPageChange={setMedicalPage}
                onPageSizeChange={setMedicalPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="medical records"
              />
            </div>

            {/* Bank & Fund Investment Reallocations List */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Bank &amp; Fund Investments / Transfers
                  </h2>
                  <p className="text-xs text-slate-500">
                    Reallocations, bank placements, and investment yield across Cash on Hand, Money
                    Market, and Short Term funds
                  </p>
                </div>
                {canManage && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => openNewEntryModal('yield')}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 text-center whitespace-nowrap active:scale-95"
                    >
                      + Investment Yield
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewEntryModal('transfer')}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 text-center whitespace-nowrap active:scale-95"
                    >
                      + Fund Transfer
                    </button>
                  </div>
                )}
              </div>
              <div className="divide-y divide-slate-200">
                {paginatedTransferRows.map((row) => {
                  const pres = resolveTransactionPresentation(row);
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:px-5 sm:py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {pres.displayTitle}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono tabular-nums">
                            {formatHumanDate(row.date)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{pres.accountSummaryLabel}</span>
                          {pres.cleanNote && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{pres.cleanNote}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                        <div
                          className={`text-sm font-mono tabular-nums font-bold ${
                            row.category === 'Investment Yield'
                              ? 'text-emerald-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {row.category === 'Investment Yield'
                            ? `+${formatPHP(pres.primaryAmount)}`
                            : `${formatPHP(pres.primaryAmount)} Transfer`}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(row);
                                setIsEntryModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 sm:p-1.5 rounded text-xs font-medium text-slate-700 sm:text-slate-400 bg-slate-100 sm:bg-transparent hover:bg-slate-200/70 hover:text-slate-900 min-h-[36px] sm:min-h-0"
                              title="Edit entry"
                              aria-label={`Edit ${row.description}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sm:hidden">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmModalState({
                                  isOpen: true,
                                  targetRow: row
                                })
                              }
                              className="flex items-center gap-1 px-2.5 py-1 sm:p-1.5 rounded text-xs font-medium text-red-600 sm:text-slate-400 bg-red-50 sm:bg-transparent hover:bg-red-100 sm:hover:bg-red-50 hover:text-red-700 min-h-[36px] sm:min-h-0"
                              title="Delete entry"
                              aria-label={`Delete ${row.description}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sm:hidden">Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationBar
                currentPage={transferPage}
                totalItems={transferRows.length}
                pageSize={transferPageSize}
                onPageChange={setTransferPage}
                onPageSizeChange={setTransferPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="transfers"
              />
            </div>
          </section>
        )}

        {/* SECTION 4: FIREBASE FIRESTORE DATABASE CONSOLE */}
        {activeSection === 'database' && (
          <DatabaseManagementView
            db={db}
            mamasState={mamasState}
            canManage={canManage}
            userEmail={user?.email}
            isSyncing={isSyncingFirestore}
            onGoogleSignIn={handleGoogleLogin}
            onDownloadJson={handleDownloadJson}
            onImportJsonFile={handleImportJsonFile}
            onReturnToDashboard={() => setActiveSection('dashboard')}
          />
        )}

        {/* SECTION 5: HELP GUIDE & FAQ */}
        {activeSection === 'help' && (
          <HelpGuideView
            canManage={canManage}
            onOpenNewEntry={() => openNewEntryModal('contribution')}
            onNavigateToSection={(s) => setActiveSection(s)}
          />
        )}
      </>
    )}
  </main>

  {/* Quiet Footer */}
  <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
    <div className="mx-auto flex max-w-[1280px] flex-col sm:flex-row items-center justify-between gap-2">
      {activeAccount === 'clan_efund' ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              Clan E-Fund Ledger · {canManage ? 'Record Manager Mode' : 'View-Only Contributor Mode'}{' '}
              (<span className="font-mono text-slate-700">{FIRESTORE_DATABASE_ID}</span>)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-600">
              v{APP_VERSION} (Schema v{db.schemaVersion || 4})
            </span>
          </div>
          <div className="font-mono tabular-nums">
            Total Fund: {formatPHP(totals.totalFund)}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              Mama&apos;s Personal Savings · {canManage ? 'Manager Mode' : 'Access Restricted'}{' '}
              (Private separate account)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-600">v{APP_VERSION}</span>
          </div>
          {canManage && (
            <div className="font-mono tabular-nums font-bold text-purple-900">
              Total Savings: {formatPHP(mamasState.totalSavings)}
            </div>
          )}
        </>
      )}
    </div>
  </footer>

  {/* Sticky Native-Like Mobile Bottom Navigation Bar (Clan E-Fund) */}
  {activeAccount === 'clan_efund' ? (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 px-1 py-1 backdrop-blur-md md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
    >
      {(
        [
          ['dashboard', 'Dashboard', LayoutDashboard],
          ['ledger', 'Activity', ReceiptText],
          ['contributors', 'Members', Users],
          ['medical', 'Medical', HeartPulse],
          ['help', 'Guide', HelpCircle],
          ...(canManage ? [['database', 'Database', Database] as const] : [])
        ] as const
      ).map(([key, label, Icon]) => {
        const isActive = activeSection === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveSection(key);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 px-1 transition-colors ${
              isActive
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                isActive ? 'stroke-[2.5px] text-slate-900' : 'stroke-[1.75px]'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight ${
                isActive ? 'font-bold text-slate-900' : 'font-medium'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  ) : (
    <nav
      aria-label="Mobile Navigation - Mama's Personal Savings"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-purple-200 bg-white/95 px-3 py-2 backdrop-blur-md md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
    >
      <button
        type="button"
        onClick={() => {
          setActiveAccount('clan_efund');
          setActiveSection('dashboard');
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700"
      >
        ← Switch to Clan E-Fund
      </button>
      <div className="text-right">
        <div className="text-[10px] uppercase font-bold tracking-wider text-purple-700">Mama&apos;s Savings</div>
        <div className="text-xs font-bold font-mono text-purple-950">
          {canManage ? formatPHP(mamasState.totalSavings) : 'Private'}
        </div>
      </div>
    </nav>
  )}

      {/* Add/Edit Entry Modal (Admin-only) */}
      {canManage && (
        <EntryFormModal
          isOpen={isEntryModalOpen}
          onClose={() => {
            setIsEntryModalOpen(false);
            setEditingEntry(null);
            setPresetDate(null);
          }}
          onSave={handleSaveEntry}
          editingEntry={editingEntry}
          members={db.members}
          presetMember={presetMember}
          presetMode={presetMode}
          presetDate={presetDate}
          isSaving={isSavingEntry}
        />
      )}

      {/* Confirmation Modal for Row Deletions (Admin-only) */}
      {canManage && (
        <DriveConfirmModal
          isOpen={confirmModalState.isOpen}
          onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={handleExecuteConfirmedAction}
          isSubmitting={isSyncingFirestore}
          targetRowDescription={confirmModalState.targetRow?.description}
          targetRowDate={confirmModalState.targetRow?.displayDate}
        />
      )}
    </div>
  );
}
