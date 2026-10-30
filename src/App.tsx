import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Plus,
  Search,
  Download,
  Upload,
  RefreshCw,
  Database,
  Pencil,
  Trash2,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  FileJson,
  ArrowUpDown,
  ArrowRight,
  Eye,
  ShieldCheck,
  ExternalLink,
  LayoutDashboard,
  ReceiptText,
  Users,
  HeartPulse,
  PiggyBank,
  HandCoins,
  Lock,
  HelpCircle
} from 'lucide-react';
import {
  ClanEFundDatabase,
  EFundTransaction,
  INITIAL_EFUND_DB,
  MAMAS_SAVINGS_DATA,
  EMPTY_MAMAS_SAVINGS_STATE,
  MamasSavingsState,
  calculateMamasTotals,
  calculateTotals,
  formatPHP
} from './data/initialLedger';
import {
  ADMIN_EMAIL,
  EXPORT_JSON_FILENAME,
  FIRESTORE_DATABASE_ID,
  SHARED_LEDGER_ID,
  deleteTransactionFromFirestore,
  ensureSharedLedgerInitializedInFirestore,
  googleSignIn,
  initAuth,
  isLedgerAdmin,
  logout,
  replaceEntireLedgerInFirestore,
  saveMamasSavingsToFirestore,
  saveTransactionToFirestore,
  subscribeToMamasSavings,
  subscribeToSharedLedger,
  updateLedgerConfigInFirestore
} from './services/firebaseDb';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { EntryFormModal, EntryPresetMode } from './components/EntryFormModal';
import { DriveConfirmModal } from './components/DriveConfirmModal';
import { MamasSavingsView } from './components/MamasSavingsView';
import { DatabaseManagementView } from './components/DatabaseManagementView';
import { HelpGuideView } from './components/HelpGuideView';

export type ActiveAccount = 'clan_efund' | 'mamas_savings';
type ActiveSection = 'dashboard' | 'ledger' | 'contributors' | 'medical' | 'database' | 'help';
type FilterTab =
  | 'all'
  | 'Contribution'
  | 'Medical Disbursement'
  | 'Internal Transfer'
  | 'Reimbursement'
  | 'Investment Yield'
  | 'Member Loan'
  | 'Loan Repayment';

type AccountFilter = 'ALL' | 'amountOnHand' | 'bpiMoneyMarket' | 'bpiShortTerm' | 'memberLoan';

const LOCAL_STORAGE_CACHE_KEY = 'clan_efund_working_copy_v6';
const MAMAS_SAVINGS_CACHE_KEY = 'mamas_savings_working_copy_v7';

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

const MONTHS_2026 = MATRIX_MONTHS_BY_YEAR['2026'];

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

function getMonthHeaderLabel(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length < 2) return 'Earlier';
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  if (isNaN(dateObj.getTime())) return isoDate;
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Resolves the primary amount, direction, and account routing for a transaction
 * so we don't need 3 mostly-empty spreadsheet columns on every row.
 */
function resolveTransactionPresentation(tx: EFundTransaction): {
  primaryAmount: number;
  isInternalTransfer: boolean;
  fromAccountLabel?: string;
  toAccountLabel?: string;
  accountSummaryLabel: string;
} {
  const { amountOnHand, bpiMoneyMarket, bpiShortTerm } = tx;
  const memberLoan = tx.memberLoan || 0;
  const net = amountOnHand + bpiMoneyMarket + bpiShortTerm + memberLoan;

  if (tx.category === 'Member Loan' || memberLoan > 0) {
    let sourceLabel = 'Cash on Hand';
    if (bpiMoneyMarket < 0) sourceLabel = 'Money Market Fund';
    else if (bpiShortTerm < 0) sourceLabel = 'Short Term Fund';
    return {
      primaryAmount: memberLoan > 0 ? memberLoan : Math.abs(amountOnHand),
      isInternalTransfer: false,
      fromAccountLabel: sourceLabel,
      toAccountLabel: 'Member Loans (Receivable)',
      accountSummaryLabel: `${sourceLabel} → Member Loan (Receivable)`
    };
  }

  if (tx.category === 'Loan Repayment' || memberLoan < 0) {
    let targetLabel = 'Cash on Hand';
    if (bpiMoneyMarket > 0) targetLabel = 'Money Market Fund';
    else if (bpiShortTerm > 0) targetLabel = 'Short Term Fund';
    return {
      primaryAmount: Math.abs(memberLoan || amountOnHand),
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
      primaryAmount: transferAmt,
      isInternalTransfer: true,
      fromAccountLabel: fromLabel,
      toAccountLabel: toLabel,
      accountSummaryLabel: `${fromLabel} → ${toLabel}`
    };
  }

  if (amountOnHand !== 0 && bpiMoneyMarket === 0 && bpiShortTerm === 0) {
    return {
      primaryAmount: amountOnHand,
      isInternalTransfer: false,
      accountSummaryLabel: 'Cash on Hand'
    };
  }

  if (bpiMoneyMarket !== 0 && amountOnHand === 0 && bpiShortTerm === 0) {
    return {
      primaryAmount: bpiMoneyMarket,
      isInternalTransfer: false,
      accountSummaryLabel: 'Money Market Fund'
    };
  }

  if (bpiShortTerm !== 0 && amountOnHand === 0 && bpiMoneyMarket === 0) {
    return {
      primaryAmount: bpiShortTerm,
      isInternalTransfer: false,
      accountSummaryLabel: 'Short Term Fund'
    };
  }

  return {
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
        if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length >= 107) {
          return {
            ...INITIAL_EFUND_DB,
            ...parsed
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
  const [groupByMonth, setGroupByMonth] = useState<boolean>(true);
  const [showPriorBalanceConfig, setShowPriorBalanceConfig] = useState<boolean>(false);
  const [selectedMatrixYear, setSelectedMatrixYear] = useState<MatrixYear>('2026');

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

  // Confirmation Modal state (Admin-only)
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    mode: 'overwrite_firestore_with_default' | 'delete_row';
    targetRow?: EFundTransaction;
  }>({
    isOpen: false,
    mode: 'overwrite_firestore_with_default'
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      try {
        localStorage.removeItem(MAMAS_SAVINGS_CACHE_KEY);
      } catch {
        // Ignore storage quota errors
      }
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
      setConfirmModalState({ isOpen: false, mode: 'overwrite_firestore_with_default' });
      return;
    }

    if (confirmModalState.mode === 'delete_row' && confirmModalState.targetRow) {
      const rowToDelete = confirmModalState.targetRow;
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
        setStatusBanner({
          type: 'error',
          message: err?.message || 'Failed to delete transaction from Firestore.'
        });
      } finally {
        setIsSyncingFirestore(false);
      }

      setConfirmModalState({ isOpen: false, mode: 'overwrite_firestore_with_default' });
      return;
    }

    // Mode: overwrite_firestore_with_default (Admin-only)
    setDb(INITIAL_EFUND_DB);
    setMamasState(calculateMamasTotals(MAMAS_SAVINGS_DATA));
    setIsSyncingFirestore(true);
    try {
      await replaceEntireLedgerInFirestore(user.uid, INITIAL_EFUND_DB);
      await saveMamasSavingsToFirestore(user.uid, calculateMamasTotals(MAMAS_SAVINGS_DATA));
      setStatusBanner({
        type: 'success',
        message:
          "Migrated all 107 E-Fund rows (₱96,770.00) and all 18 Mama's Savings rows (₱63,200.00) from the Excel spreadsheet into Firebase Firestore."
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to reset Firestore database.'
      });
    } finally {
      setIsSyncingFirestore(false);
    }
    setConfirmModalState({ isOpen: false, mode: 'overwrite_firestore_with_default' });
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

    const nextRowRef =
      db.transactions.reduce((max, t) => Math.max(max, t.rowRef || 92), 111) + 1;
    const assignedId = existingId || `row-${Date.now()}`;
    const updatedMembers =
      newMember && !db.members.includes(newMember)
        ? [...db.members, newMember]
        : db.members;

    // Optimistic local state update
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
        existingId || assignedId,
        nextRowRef
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
      'BPI Short Term'
    ];
    const rows = db.transactions.map((t) => [
      `"${t.date}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.memberOrBeneficiary}"`,
      t.amountOnHand.toFixed(2),
      t.bpiMoneyMarket.toFixed(2),
      t.bpiShortTerm.toFixed(2)
    ]);
    const currentTotals = calculateTotals(db);
    rows.push([
      '""',
      '"Account Totals"',
      '""',
      '""',
      currentTotals.amountOnHand.toFixed(2),
      currentTotals.bpiMoneyMarket.toFixed(2),
      currentTotals.bpiShortTerm.toFixed(2)
    ]);
    rows.push(['""', '"Total Fund"', '""', '""', '', currentTotals.totalFund.toFixed(2), '']);

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
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as ClanEFundDatabase;
        if (!parsed || !Array.isArray(parsed.transactions)) {
          throw new Error('Invalid Clan E-Fund JSON structure.');
        }
        const mergedDb: ClanEFundDatabase = {
          ...INITIAL_EFUND_DB,
          ...parsed
        };
        setDb(mergedDb);

        setIsSyncingFirestore(true);
        await replaceEntireLedgerInFirestore(user.uid, mergedDb);
        setIsSyncingFirestore(false);
        setStatusBanner({
          type: 'success',
          message: `Imported ${parsed.transactions.length} records from ${file.name} and synced to Firebase Firestore.`
        });
      } catch (err: any) {
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
      if (filterTab !== 'all' && tx.category !== filterTab) return false;
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
      const delta = tx.amountOnHand + tx.bpiMoneyMarket + tx.bpiShortTerm + (tx.memberLoan || 0);
      if (delta > 0) inflows += delta;
      if (delta < 0) outflows += Math.abs(delta);
      net += delta;
    }
    return { inflows, outflows, net, count: filteredRows.length };
  }, [filteredRows]);

  // Group filtered rows by month for clean modern ledger sections
  const groupedTransactions = useMemo(() => {
    const groups: {
      monthKey: string;
      monthLabel: string;
      netChange: number;
      items: typeof filteredRows;
    }[] = [];

    for (const row of filteredRows) {
      const mKey = row.date.slice(0, 7);
      const lastGroup = groups[groups.length - 1];
      const rowNet = row.amountOnHand + row.bpiMoneyMarket + row.bpiShortTerm + (row.memberLoan || 0);

      if (!lastGroup || lastGroup.monthKey !== mKey) {
        groups.push({
          monthKey: mKey,
          monthLabel: getMonthHeaderLabel(row.date),
          netChange: rowNet,
          items: [row]
        });
      } else {
        lastGroup.items.push(row);
        lastGroup.netChange += rowNet;
      }
    }
    return groups;
  }, [filteredRows]);

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
      if (tx.category === 'Contribution' || tx.category === 'Reimbursement') {
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

  const medicalRows = useMemo(
    () =>
      [...rowsWithRunningTotals]
        .filter((t) => t.category === 'Medical Disbursement' || t.category === 'Reimbursement')
        .reverse(),
    [rowsWithRunningTotals]
  );

  const transferRows = useMemo(
    () =>
      [...rowsWithRunningTotals]
        .filter((t) => t.category === 'Internal Transfer' || t.category === 'Investment Yield')
        .reverse(),
    [rowsWithRunningTotals]
  );

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

  const totalYieldEarned = useMemo(
    () =>
      db.transactions
        .filter((t) => t.category === 'Investment Yield')
        .reduce((acc, t) => acc + t.amountOnHand + t.bpiMoneyMarket + t.bpiShortTerm, 0),
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
                  <span className="text-xs text-slate-400">All 3 Accounts →</span>
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
                    Clan Contributions (2026)
                  </span>
                  <span className="text-xs text-slate-400">{db.members.length} members →</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  +{formatPHP(totalContributionsOnly + totalReimbursements)}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{formatPHP(totalContributionsOnly)} contributions</span>
                  <span aria-hidden="true">·</span>
                  <span>+{formatPHP(priorTotalForward)} prior bal</span>
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
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('loan')}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 text-center active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <HandCoins className="h-3 w-3" />
                        <span>+ Lend Member</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('loan_repayment')}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 text-center active:scale-95 transition-all"
                      >
                        + Collect Loan
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('contribution', 'Nene')}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-center active:scale-95 transition-all"
                      >
                        + Nene ₱5k
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
                                  {tx.description}
                                </span>
                                {tx.highlightAlert && (
                                  <span className="text-xs font-semibold text-red-600 shrink-0">
                                    · Priority Medical
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span className="font-mono tabular-nums">
                                  {formatHumanDate(tx.date)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{tx.category}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-slate-700">
                                  {tx.memberOrBeneficiary}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{pres.accountSummaryLabel}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${
                                  pres.isInternalTransfer
                                    ? 'text-slate-800'
                                    : pres.primaryAmount > 0
                                    ? 'text-emerald-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {pres.isInternalTransfer
                                  ? `${formatPHP(pres.primaryAmount)} Transfer`
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
                  <button
                    type="button"
                    onClick={() => setActiveSection('ledger')}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    Open Full Activity Ledger →
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Contributor Standings & Medical / Investment Health */}
              <div className="lg:col-span-5 space-y-6">
                {/* Contributor Standings Card */}
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Contributor Standings</h2>
                      <p className="text-xs text-slate-500">Apr – Oct 2026 cumulative inflows</p>
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
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('medical', 'Papa')}
                        className="font-semibold text-red-700 hover:underline"
                      >
                        + Log Medical Expense
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 1: MODERN TREASURY ACTIVITY STREAM (NO SPREADSHEET CLUTTER) */}
        {activeSection === 'ledger' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Activity Ledger</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological record of contributions, medical disbursements, and fund transfers
                  {accountFilter !== 'ALL' && (
                    <>
                      {' '}
                      · Filtered by account (
                      <button
                        type="button"
                        onClick={() => setAccountFilter('ALL')}
                        className="font-semibold text-slate-900 underline"
                      >
                        Show all accounts
                      </button>
                      )
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {canManage && (
                  <button
                    type="button"
                    disabled={isSyncingFirestore}
                    onClick={() =>
                      setConfirmModalState({
                        isOpen: true,
                        mode: 'overwrite_firestore_with_default'
                      })
                    }
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                    <span>Remigrate All 107 Excel Rows to DB</span>
                  </button>
                )}
                <div className="text-xs text-slate-600 font-mono tabular-nums shrink-0">
                  Total Clan E-Fund:{' '}
                  <strong className="text-emerald-700 font-bold">
                    {formatPHP(totals.totalFund)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Account Bucket Quick Filter Strip */}
            <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1.5 touch-pan-x no-scrollbar">
              <div className="inline-flex items-center gap-1.5 text-xs min-w-max">
                <span className="text-slate-500 font-semibold shrink-0 mr-1">Account Bucket:</span>
                <button
                  type="button"
                  onClick={() => setAccountFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                    accountFilter === 'ALL'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Accounts ({formatPHP(totals.totalFund)})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('amountOnHand')}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                    accountFilter === 'amountOnHand'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cash on Hand ({formatPHP(totals.amountOnHand)})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('bpiMoneyMarket')}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                    accountFilter === 'bpiMoneyMarket'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Money Market ({formatPHP(totals.bpiMoneyMarket)})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('bpiShortTerm')}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                    accountFilter === 'bpiShortTerm'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Short Term ({formatPHP(totals.bpiShortTerm)})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('memberLoan')}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    accountFilter === 'memberLoan'
                      ? 'border-amber-700 bg-amber-700 text-white shadow-xs'
                      : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <HandCoins className="h-3.5 w-3.5" />
                  <span>Member Loans ({formatPHP(totals.memberLoan)})</span>
                </button>
              </div>
            </div>

            {/* Year & Month Filter Bar */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3 min-w-0 max-w-full">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
                {/* Year Filter Strip */}
                <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar">
                  <div className="inline-flex items-center gap-1.5 min-w-max">
                    <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Year:</span>
                    <button
                      type="button"
                      onClick={() => setYearFilter('ALL')}
                      className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                        yearFilter === 'ALL'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      All Years ({db.transactions.length})
                    </button>
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setYearFilter(yr)}
                        className={`px-3 py-1.5 rounded-md border text-xs font-semibold font-mono tabular-nums transition-colors shrink-0 ${
                          yearFilter === yr
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {yr} ({yearRowCounts[yr] || 0})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Month Filter Strip */}
                <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar">
                  <div className="inline-flex items-center gap-1 min-w-max">
                    <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Month:</span>
                    {LEDGER_MONTH_OPTIONS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMonthFilter(m.value)}
                        className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-colors shrink-0 ${
                          monthFilter === m.value
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {m.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Responsive Period & Filter Summary */}
              <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-slate-700 flex flex-wrap items-center gap-1.5">
                    <span>
                      Showing{' '}
                      <strong className="font-mono tabular-nums text-slate-900">
                        {filteredSummary.count}
                      </strong>{' '}
                      of {db.transactions.length} records
                    </span>
                    {(yearFilter !== 'ALL' || monthFilter !== 'ALL') && (
                      <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {yearFilter === 'ALL' ? 'All Years' : yearFilter} ·{' '}
                        {LEDGER_MONTH_OPTIONS.find((m) => m.value === monthFilter)?.label || 'All Months'}
                      </span>
                    )}
                  </div>

                  {(yearFilter !== 'ALL' ||
                    monthFilter !== 'ALL' ||
                    filterTab !== 'all' ||
                    accountFilter !== 'ALL' ||
                    memberFilter !== 'ALL' ||
                    searchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setYearFilter('ALL');
                        setMonthFilter('ALL');
                        setFilterTab('all');
                        setAccountFilter('ALL');
                        setMemberFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="text-xs font-semibold text-emerald-800 underline hover:no-underline shrink-0"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* 3-Column Mobile-Friendly Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="rounded-md bg-emerald-50/70 border border-emerald-100 px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      Period Inflows
                    </span>
                    <strong className="font-mono tabular-nums text-emerald-700 text-xs sm:text-sm font-bold truncate">
                      +{formatPHP(filteredSummary.inflows)}
                    </strong>
                  </div>

                  <div className="rounded-md bg-red-50/70 border border-red-100 px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      Period Outflows
                    </span>
                    <strong className="font-mono tabular-nums text-red-600 text-xs sm:text-sm font-bold truncate">
                      -{formatPHP(filteredSummary.outflows)}
                    </strong>
                  </div>

                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      Net Flow
                    </span>
                    <strong
                      className={`font-mono tabular-nums text-xs sm:text-sm font-bold truncate ${
                        filteredSummary.net >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {filteredSummary.net >= 0
                        ? `+${formatPHP(filteredSummary.net)}`
                        : formatPHP(filteredSummary.net)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & View Controls */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between min-w-0 max-w-full">
              {/* Category Segmented Scrollable Strip on Mobile */}
              <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 touch-pan-x no-scrollbar xl:w-auto">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg min-w-max">
                  {(
                    [
                      ['all', 'All Activity'],
                      ['Contribution', 'Contributions'],
                      ['Medical Disbursement', 'Medical'],
                      ['Internal Transfer', 'Fund Transfers'],
                      ['Investment Yield', 'Fund Yield'],
                      ['Reimbursement', 'Reimbursements'],
                      ['Member Loan', 'Member Loans'],
                      ['Loan Repayment', 'Loan Repayments']
                    ] as [FilterTab, string][]
                  ).map(([tabKey, label]) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setFilterTab(tabKey)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        filterTab === tabKey
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>


              {/* Search, Filter & Quick Options */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full xl:w-auto">
                <div className="relative w-full sm:w-52">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="flex-1 sm:flex-initial rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-hidden"
                  >
                    <option value="ALL">All People &amp; Accounts</option>
                    {db.members.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="Papa">Papa (Medical)</option>
                    <option value="Mama">Mama (Medical)</option>
                    <option value="Parents">Parents (Medical)</option>
                    <option value="BPI Funds">Fund Transfers / Investments</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setGroupByMonth((v) => !v)}
                    className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 text-xs font-semibold border rounded-md transition-colors whitespace-nowrap text-center ${
                      groupByMonth
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Group by Month
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSortOrder((prev) =>
                        prev === 'newest_desc' ? 'oldest_asc' : 'newest_desc'
                      )
                    }
                    className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>{sortOrder === 'newest_desc' ? 'Newest' : 'Oldest'}</span>
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setShowPriorBalanceConfig((v) => !v)}
                      className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Opening Bal</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
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
                      Cumulative balances accumulated prior to April 27, 2026 so your current
                      account balances match{' '}
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
                        handleUpdatePriorBalanceForward({
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
                        handleUpdatePriorBalanceForward({
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
                        handleUpdatePriorBalanceForward({
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
                        handleUpdatePriorBalanceForward({
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

            {/* Modern Fintech Transaction Ledger (Zero Spreadsheet Gridlines) */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {/* Clean Column Headers */}
              <div className="hidden md:grid md:grid-cols-12 items-center border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold text-slate-500">
                <div className="col-span-2">Date</div>
                <div className={canManage ? 'col-span-4' : 'col-span-5'}>
                  Transaction & Category
                </div>
                <div className="col-span-3">Account Routing</div>
                <div className="col-span-2 text-right">Amount & Fund Balance</div>
                {canManage && <div className="col-span-1 text-right">Manage</div>}
              </div>

              {filteredRows.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No transactions match your current filter
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Clear your filter selection to view all Clan E-Fund transactions.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setYearFilter('ALL');
                        setMonthFilter('ALL');
                        setFilterTab('all');
                        setAccountFilter('ALL');
                        setMemberFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset Filters
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openNewEntryModal('contribution')}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Record Transaction
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {groupedTransactions.map((group) => (
                    <React.Fragment key={group.monthKey}>
                      {groupByMonth && (
                        <div className="flex items-center justify-between bg-slate-50/90 px-5 py-2 text-xs">
                          <span className="font-bold text-slate-800">{group.monthLabel}</span>
                          <div className="flex items-center gap-3 text-slate-500">
                            <span>{group.items.length} entries</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Net Monthly Flow:{' '}
                              <strong
                                className={`font-mono tabular-nums ${
                                  group.netChange > 0
                                    ? 'text-emerald-700'
                                    : group.netChange < 0
                                    ? 'text-red-600'
                                    : 'text-slate-700'
                                }`}
                              >
                                {group.netChange > 0
                                  ? `+${formatPHP(group.netChange)}`
                                  : formatPHP(group.netChange)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      )}

                      {group.items.map((tx) => {
                        const pres = resolveTransactionPresentation(tx);

                        return (
                          <div
                            key={tx.id}
                            className="group p-4 sm:px-5 sm:py-3.5 transition-colors hover:bg-slate-50/80 md:grid md:grid-cols-12 md:items-center md:gap-4 flex flex-col gap-2"
                          >
                            {/* Mobile Primary Header Row (Description & Unified Amount Side-by-Side) */}
                            <div className="flex items-start justify-between gap-3 md:hidden">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 leading-snug">
                                  {tx.description}
                                </div>
                                {tx.highlightAlert && (
                                  <span className="text-xs font-semibold text-red-600 block mt-0.5">
                                    · Priority Medical
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div
                                  className={`text-base font-bold font-mono tabular-nums whitespace-nowrap ${
                                    pres.isInternalTransfer
                                      ? 'text-slate-800'
                                      : pres.primaryAmount > 0
                                      ? 'text-emerald-700'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {pres.isInternalTransfer
                                    ? `${formatPHP(pres.primaryAmount)} Transfer`
                                    : pres.primaryAmount > 0
                                    ? `+${formatPHP(pres.primaryAmount)}`
                                    : formatPHP(pres.primaryAmount)}
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                  Fund: {formatPHP(tx.runningTotalFund)}
                                </div>
                              </div>
                            </div>

                            {/* Desktop Date Column */}
                            <div className="hidden md:block md:col-span-2">
                              <div className="text-sm font-medium text-slate-900 font-mono tabular-nums">
                                {formatHumanDate(tx.date)}
                              </div>
                              <div className="text-xs text-slate-400 font-mono tabular-nums">
                                Ref #{tx.rowRef || '—'}
                              </div>
                            </div>

                            {/* Desktop Description Column */}
                            <div
                              className={`hidden md:block ${
                                canManage ? 'md:col-span-4' : 'md:col-span-5'
                              } min-w-0`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {tx.description}
                                </span>
                                {tx.highlightAlert && (
                                  <span className="text-xs font-semibold text-red-600 shrink-0">
                                    · Priority Medical
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span>{tx.category}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-slate-700">
                                  {tx.memberOrBeneficiary}
                                </span>
                                {tx.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-400 truncate max-w-[260px]">
                                      {tx.notes}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Mobile Metadata Details Line */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 md:hidden">
                              <span className="font-mono tabular-nums font-medium text-slate-700">
                                {formatHumanDate(tx.date)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{tx.category}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-slate-800">
                                {tx.memberOrBeneficiary}
                              </span>
                              {tx.notes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-slate-400 truncate max-w-[200px]">
                                    {tx.notes}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Account Routing (Both Mobile and Desktop) */}
                            <div className="md:col-span-3 text-xs text-slate-600">
                              {pres.isInternalTransfer ? (
                                <div className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                  <span>{pres.fromAccountLabel}</span>
                                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{pres.toAccountLabel}</span>
                                </div>
                              ) : (
                                <div className="font-medium text-slate-700">
                                  {pres.accountSummaryLabel}
                                </div>
                              )}
                              <div className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums">
                                {tx.amountOnHand !== 0 &&
                                  `Cash Bal: ${formatPHP(tx.runningOnHand)}`}
                                {tx.bpiMoneyMarket !== 0 &&
                                  tx.amountOnHand === 0 &&
                                  `MMF Bal: ${formatPHP(tx.runningMMF)}`}
                                {tx.bpiShortTerm !== 0 &&
                                  tx.amountOnHand === 0 &&
                                  tx.bpiMoneyMarket === 0 &&
                                  `Short Term Bal: ${formatPHP(tx.runningShortTerm)}`}
                              </div>
                            </div>

                            {/* Desktop Unified Amount & Running Total */}
                            <div className="hidden md:block md:col-span-2 md:text-right">
                              <div
                                className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap ${
                                  pres.isInternalTransfer
                                    ? 'text-slate-800'
                                    : pres.primaryAmount > 0
                                    ? 'text-emerald-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {pres.isInternalTransfer
                                  ? `${formatPHP(pres.primaryAmount)} Transfer`
                                  : pres.primaryAmount > 0
                                  ? `+${formatPHP(pres.primaryAmount)}`
                                  : formatPHP(pres.primaryAmount)}
                              </div>
                              <div className="text-xs font-mono tabular-nums text-slate-400">
                                Fund: {formatPHP(tx.runningTotalFund)}
                              </div>
                            </div>

                            {/* Admin-Only Actions (Comfortable Touch Targets on Mobile) */}
                            {canManage && (
                              <div className="md:col-span-1 flex items-center justify-end gap-2 md:gap-1 pt-2 md:pt-0 border-t border-slate-100 md:border-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEntry(tx);
                                    setIsEntryModalOpen(true);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 md:p-1.5 rounded-md text-xs font-medium text-slate-700 md:text-slate-400 bg-slate-100 md:bg-transparent hover:bg-slate-200/70 hover:text-slate-900 min-h-[38px] md:min-h-0"
                                  title="Edit transaction"
                                  aria-label={`Edit ${tx.description}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span className="md:hidden">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModalState({
                                      isOpen: true,
                                      mode: 'delete_row',
                                      targetRow: tx
                                    })
                                  }
                                  className="flex items-center gap-1.5 px-3 py-1.5 md:p-1.5 rounded-md text-xs font-medium text-red-600 md:text-slate-400 bg-red-50 md:bg-transparent hover:bg-red-100 md:hover:bg-red-50 hover:text-red-700 min-h-[38px] md:min-h-0"
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
                    </React.Fragment>
                  ))}

                  {/* Opening Balance Row at bottom/top of stream */}
                  {db.priorBalanceForward.included &&
                    filterTab === 'all' &&
                    memberFilter === 'ALL' &&
                    !searchQuery && (
                      <div className="grid grid-cols-1 gap-2 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-600 md:grid-cols-12 md:items-center md:gap-4">
                        <div className="md:col-span-2 font-mono tabular-nums text-slate-500">
                          Prior to Apr 27, 2026
                        </div>
                        <div className={canManage ? 'md:col-span-4' : 'md:col-span-5'}>
                          <div className="font-semibold text-slate-800">
                            {db.priorBalanceForward.label}
                          </div>
                          <div className="text-slate-500">
                            Opening Cash: {formatPHP(db.priorBalanceForward.amountOnHand)} · MMF:{' '}
                            {formatPHP(db.priorBalanceForward.bpiMoneyMarket)} · Short Term:{' '}
                            {formatPHP(db.priorBalanceForward.bpiShortTerm)}
                          </div>
                        </div>
                        <div className="md:col-span-3 text-slate-500">
                          Initial Balance Forward
                        </div>
                        <div className="md:col-span-2 md:text-right font-mono tabular-nums font-bold text-slate-800">
                          {formatPHP(
                            db.priorBalanceForward.amountOnHand +
                              db.priorBalanceForward.bpiMoneyMarket +
                              db.priorBalanceForward.bpiShortTerm
                          )}
                        </div>
                        {canManage && (
                          <div className="md:col-span-1 text-right">
                            <button
                              type="button"
                              onClick={() => setShowPriorBalanceConfig((v) => !v)}
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

              {/* Clean Ledger Summary Footer */}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                  <span>
                    Cash on Hand:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatPHP(totals.amountOnHand)}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    BPI Money Market:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatPHP(totals.bpiMoneyMarket)}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    BPI Short Term:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatPHP(totals.bpiShortTerm)}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-700">Total Clan E-Fund:</span>
                  <span className="font-mono tabular-nums text-base font-bold text-emerald-700">
                    {formatPHP(totals.totalFund)}
                  </span>
                </div>
              </div>
            </div>
          </section>
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
              {canManage && (
                <button
                  type="button"
                  onClick={() => openNewEntryModal('contribution')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start"
                >
                  + Log Member Contribution
                </button>
              )}
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
                        {contributorStats.map((stat) => {
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
                {medicalRows.map((row) => {
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
                              {row.description}
                            </span>
                            {row.highlightAlert && (
                              <span className="text-xs font-semibold text-red-600 shrink-0">
                                · Priority Medical
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <span className="font-mono tabular-nums">{formatHumanDate(row.date)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{row.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-slate-700">
                              {row.memberOrBeneficiary}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{pres.accountSummaryLabel}</span>
                            {row.notes && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-400 truncate max-w-[200px]">{row.notes}</span>
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
                                mode: 'delete_row',
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
                {transferRows.map((row) => {
                  const pres = resolveTransactionPresentation(row);
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:px-5 sm:py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {row.description}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono tabular-nums">
                            {formatHumanDate(row.date)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{pres.accountSummaryLabel}</span>
                          {row.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{row.notes}</span>
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
                                  mode: 'delete_row',
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
            onOpenResetConfirmModal={() =>
              setConfirmModalState({
                isOpen: true,
                mode: 'overwrite_firestore_with_default'
              })
            }
            onDownloadJson={handleDownloadJson}
            onDownloadCsv={handleDownloadCsv}
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
          <div>
            Clan E-Fund Ledger · {canManage ? 'Record Manager Mode' : 'View-Only Contributor Mode'}{' '}
            (<span className="font-mono text-slate-700">{FIRESTORE_DATABASE_ID}</span>)
          </div>
          <div className="font-mono tabular-nums">
            Total Fund: {formatPHP(totals.totalFund)}
          </div>
        </>
      ) : (
        <>
          <div>
            Mama&apos;s Personal Savings · {canManage ? 'Manager Mode' : 'Access Restricted'}{' '}
            (Private separate account)
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

      {/* Confirmation Modal for Firestore Reset & Row Deletions (Admin-only) */}
      {canManage && (
        <DriveConfirmModal
          isOpen={confirmModalState.isOpen}
          mode={confirmModalState.mode}
          onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={handleExecuteConfirmedAction}
          isSubmitting={isSyncingFirestore}
          db={
            confirmModalState.mode === 'overwrite_firestore_with_default' ? INITIAL_EFUND_DB : db
          }
          targetRowDescription={confirmModalState.targetRow?.description}
          targetRowDate={confirmModalState.targetRow?.displayDate}
        />
      )}
    </div>
  );
}
