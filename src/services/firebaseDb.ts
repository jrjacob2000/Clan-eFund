import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ClanEFundDatabase,
  DEFAULT_MAMAS_BUCKET_LABELS,
  EFundTransaction,
  EntryCategory,
  INITIAL_EFUND_DB,
  MamasBucketCategory,
  MamasBucketLabels,
  MamasCustomBucket,
  MamasSavingsState,
  MAMAS_SAVINGS_DATA
} from '../data/initialLedger';

const isAiStudioDevEnvironment =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.run.app')
    : true;

const viteEnv: Record<string, any> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : {};

const DEFAULT_FIRESTORE_DB_ID =
  'ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a';

const rawViteDbId = String(viteEnv.VITE_FIREBASE_DATABASE_ID || '').trim();
const resolvedProdDatabaseId =
  rawViteDbId && rawViteDbId !== '(default)'
    ? rawViteDbId
    : DEFAULT_FIRESTORE_DB_ID;

/**
 * Production Firebase configuration locked to project `clan-e-fund-ledger`
 * for GitHub Pages (`*.github.io`) and external production deployments.
 */
export const PRODUCTION_FIREBASE_CONFIG = {
  projectId:
    String(viteEnv.VITE_FIREBASE_PROJECT_ID || '').trim() || 'clan-e-fund-ledger',
  appId:
    String(viteEnv.VITE_FIREBASE_APP_ID || '').trim() ||
    '1:305671424873:web:371467f93c769bd8db4bf8',
  apiKey:
    String(viteEnv.VITE_FIREBASE_API_KEY || '').trim() ||
    'AIzaSyCX1r8h1nVjZYdSo5Nv32Bt6xJXrF7RI2c',
  authDomain:
    String(viteEnv.VITE_FIREBASE_AUTH_DOMAIN || '').trim() ||
    'clan-e-fund-ledger.firebaseapp.com',
  firestoreDatabaseId: resolvedProdDatabaseId,
  storageBucket:
    String(viteEnv.VITE_FIREBASE_STORAGE_BUCKET || '').trim() ||
    'clan-e-fund-ledger.firebasestorage.app',
  messagingSenderId:
    String(viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim() || '305671424873',
  measurementId: '',
  oAuthClientId: '305671424873-ula1jht7cmukc3bthku0hklraa06l8ro.apps.googleusercontent.com',
  recaptchaSiteKey: ''
};

/**
 * In AI Studio preview / local dev (`*.run.app` / `localhost`), use `firebase-applet-config.json` (Dev Firebase).
 * On external production hosts (e.g., GitHub Pages `*.github.io`), automatically use `PRODUCTION_FIREBASE_CONFIG` (`clan-e-fund-ledger`).
 */
export const ACTIVE_FIREBASE_ENV: 'aistudio-dev' | 'production' = isAiStudioDevEnvironment
  ? 'aistudio-dev'
  : 'production';

export const SHARED_LEDGER_ID = 'clan-efund-main';
export const MAMAS_SAVINGS_DOC_ID = 'state';

export const ACTIVE_FIREBASE_ENV_LABEL =
  ACTIVE_FIREBASE_ENV === 'aistudio-dev'
    ? `AI Studio Dev Database (clanefund-dev)`
    : `Production Live Database (${DEFAULT_FIRESTORE_DB_ID})`;

const rawAppletDbId = String(
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || ''
).trim();
const resolvedAppletDatabaseId =
  rawAppletDbId && rawAppletDbId !== '(default)'
    ? rawAppletDbId
    : DEFAULT_FIRESTORE_DB_ID;

const activeFirebaseConfig: typeof PRODUCTION_FIREBASE_CONFIG =
  ACTIVE_FIREBASE_ENV === 'production'
    ? PRODUCTION_FIREBASE_CONFIG
    : {
        ...firebaseConfig,
        firestoreDatabaseId: resolvedAppletDatabaseId
      };

const app = initializeApp(activeFirebaseConfig);
export const auth: ReturnType<typeof getAuth> =
  typeof window !== 'undefined' ? getAuth(app) : ({ currentUser: null } as any);
export const db = getFirestore(app, activeFirebaseConfig.firestoreDatabaseId);

export const EXPORT_JSON_FILENAME = 'clan-efund-ledger.json';
export const FIREBASE_PROJECT_ID = activeFirebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID =
  activeFirebaseConfig.firestoreDatabaseId || DEFAULT_FIRESTORE_DB_ID;
export const ADMIN_EMAIL = 'jrjacob2000@gmail.com';
export const MAMAS_SAVINGS_CACHE_KEY = 'mamas_savings_working_copy_v7';

/**
 * Purges all current and legacy Mama's Personal Savings keys from localStorage
 * whenever a user is not verified as the Record Manager or signs out.
 */
export function purgeMamasSavingsLocalCache(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(MAMAS_SAVINGS_CACHE_KEY);
    localStorage.removeItem('mamas_personal_savings_v2_cache');
    for (const key of Object.keys(localStorage)) {
      if (/^mamas_(personal_)?savings/i.test(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore Web Storage access errors
  }
}

/**
 * Sanitizes a text value for CSV export by escaping double quotes and neutralizing
 * leading spreadsheet formula triggers (=, +, -, @, tab, CR).
 */
export function sanitizeCsvCell(raw: string | undefined | null): string {
  const str = String(raw ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function isLedgerAdmin(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. ');
    }
  }
}
testConnection();

const VALID_CATEGORIES: EntryCategory[] = [
  'Contribution',
  'Medical Disbursement',
  'Internal Transfer',
  'Reimbursement',
  'Investment Yield',
  'Opening Balance',
  'Member Loan',
  'Loan Repayment'
];

export function sanitizeDocId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `row-${Date.now()}`;
}

export function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(min, Math.min(max, Number(val.toFixed(2))));
}

export function sanitizeMembersList(members: string[]): string[] {
  const cleaned = members
    .map((m) => String(m || '').trim().slice(0, 60))
    .filter((m) => m.length >= 1);
  if (cleaned.length === 0) {
    return ['Nene', 'Laura', 'Jonathan', 'Dondon'];
  }
  return cleaned.slice(0, 30);
}

export function buildTransactionCreatePayload(
  adminUid: string,
  tx: Omit<EFundTransaction, 'id'>,
  fallbackRowRef: number
) {
  const category: EntryCategory = VALID_CATEGORIES.includes(tx.category)
    ? tx.category
    : 'Contribution';
  const dateStr = (tx.date || new Date().toISOString().slice(0, 10)).trim().slice(0, 32);
  const displayDateStr = (tx.displayDate || dateStr).trim().slice(0, 32);
  const descStr = (tx.description || 'Clan Transaction').trim().slice(0, 200) || 'Transaction';
  const memberStr =
    (tx.memberOrBeneficiary || 'Clan Member').trim().slice(0, 100) || 'Clan Member';
  const notesStr = (tx.notes || '').trim().slice(0, 500);
  const rowRefNum = Math.max(
    0,
    Math.min(1000000, Math.round(Number(tx.rowRef ?? fallbackRowRef)))
  );

  return {
    ledgerId: SHARED_LEDGER_ID,
    ownerId: adminUid,
    rowRef: rowRefNum,
    date: dateStr,
    displayDate: displayDateStr,
    description: descStr,
    category,
    memberOrBeneficiary: memberStr,
    amountOnHand: clampNumber(tx.amountOnHand, -100000000, 100000000),
    bpiMoneyMarket: clampNumber(tx.bpiMoneyMarket, -100000000, 100000000),
    bpiShortTerm: clampNumber(tx.bpiShortTerm, -100000000, 100000000),
    memberLoan: clampNumber(tx.memberLoan ?? 0, -100000000, 100000000),
    highlightAlert: Boolean(tx.highlightAlert),
    notes: notesStr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

export function buildTransactionUpdatePayload(
  tx: Omit<EFundTransaction, 'id'>,
  fallbackRowRef: number
) {
  const category: EntryCategory = VALID_CATEGORIES.includes(tx.category)
    ? tx.category
    : 'Contribution';
  const dateStr = (tx.date || new Date().toISOString().slice(0, 10)).trim().slice(0, 32);
  const displayDateStr = (tx.displayDate || dateStr).trim().slice(0, 32);
  const descStr = (tx.description || 'Clan Transaction').trim().slice(0, 200) || 'Transaction';
  const memberStr =
    (tx.memberOrBeneficiary || 'Clan Member').trim().slice(0, 100) || 'Clan Member';
  const notesStr = (tx.notes || '').trim().slice(0, 500);
  const rowRefNum = Math.max(
    0,
    Math.min(1000000, Math.round(Number(tx.rowRef ?? fallbackRowRef)))
  );

  return {
    rowRef: rowRefNum,
    date: dateStr,
    displayDate: displayDateStr,
    description: descStr,
    category,
    memberOrBeneficiary: memberStr,
    amountOnHand: clampNumber(tx.amountOnHand, -100000000, 100000000),
    bpiMoneyMarket: clampNumber(tx.bpiMoneyMarket, -100000000, 100000000),
    bpiShortTerm: clampNumber(tx.bpiShortTerm, -100000000, 100000000),
    memberLoan: clampNumber(tx.memberLoan ?? 0, -100000000, 100000000),
    highlightAlert: Boolean(tx.highlightAlert),
    notes: notesStr,
    updatedAt: serverTimestamp()
  };
}

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
];

// In-memory cache for Google Workspace OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export async function googleSignIn(): Promise<User | null> {
  // Standard Firebase Google Sign-In uses only non-sensitive profile/email scopes
  // so login is never blocked by Google Workspace OAuth verification checks.
  const provider = new GoogleAuthProvider();
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    if (!isLedgerAdmin(result.user)) {
      cachedAccessToken = null;
      purgeMamasSavingsLocalCache();
    }
    return result.user;
  } finally {
    isSigningIn = false;
  }
}

export async function authorizeGoogleDriveAccess(): Promise<string> {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'consent' });
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    if (!isLedgerAdmin(result.user)) {
      cachedAccessToken = null;
      purgeMamasSavingsLocalCache();
      throw new Error(`Unauthorized: Google Drive backup is restricted to ${ADMIN_EMAIL}.`);
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive & Sheets access token.');
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } finally {
    isSigningIn = false;
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
  purgeMamasSavingsLocalCache();
}

export function initAuth(
  onAuthenticated: (user: User) => void,
  onUnauthenticated: () => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!cachedAccessToken && !isSigningIn) {
        cachedAccessToken = null;
      }
      if (!isLedgerAdmin(user)) {
        purgeMamasSavingsLocalCache();
      }
      onAuthenticated(user);
    } else {
      cachedAccessToken = null;
      purgeMamasSavingsLocalCache();
      onUnauthenticated();
    }
  });
}

/**
 * Ensures the shared clan ledger `/ledgers/clan-efund-main` exists in Firestore.
 * Called only when the verified Admin (jrjacob2000@gmail.com) is signed in.
 */
export async function ensureSharedLedgerInitializedInFirestore(
  adminUid: string,
  seedDb: ClanEFundDatabase = INITIAL_EFUND_DB
): Promise<{ createdNew: boolean }> {
  const ledgerPath = `ledgers/${SHARED_LEDGER_ID}`;
  const ledgerRef = doc(db, 'ledgers', SHARED_LEDGER_ID);

  let snap;
  try {
    snap = await getDoc(ledgerRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, ledgerPath);
  }

  if (snap && snap.exists()) {
    // Verify that the full 107-row Excel migration (starting at row-4, 2024-01-27) is present
    const firstExcelRowRef = doc(db, 'ledgers', SHARED_LEDGER_ID, 'transactions', 'row-4');
    let firstRowSnap;
    try {
      firstRowSnap = await getDoc(firstExcelRowRef);
    } catch {
      firstRowSnap = null;
    }

    // Check transaction count and verify first row exists
    const txQuery = query(
      collection(db, 'ledgers', SHARED_LEDGER_ID, 'transactions'),
      where('ledgerId', '==', SHARED_LEDGER_ID)
    );
    let existingTxCount = 0;
    try {
      const txsSnap = await getDocs(txQuery);
      existingTxCount = txsSnap.size;
    } catch {
      existingTxCount = 0;
    }

    // Only auto-seed if the database is truly empty or still holds the legacy <=25-row pre-Excel seed.
    // Never overwrite a populated ledger (>25 rows) even if the admin intentionally deleted row-4.
    const needsFullExcelMigration =
      existingTxCount === 0 ||
      (existingTxCount <= 25 && (!firstRowSnap || !firstRowSnap.exists()));

    if (needsFullExcelMigration) {
      await replaceEntireLedgerInFirestore(adminUid, INITIAL_EFUND_DB);
      const mamasRef = doc(db, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);
      try {
        const mamasSnap = await getDoc(mamasRef);
        if (!mamasSnap.exists()) {
          await saveMamasSavingsToFirestore(adminUid, MAMAS_SAVINGS_DATA);
        }
      } catch {
        // Ignore if non-fatal
      }
      return { createdNew: true };
    }

    // Ensure Mama's personal savings document is also initialized in Firestore if missing
    const mamasRef = doc(db, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);
    try {
      const mamasSnap = await getDoc(mamasRef);
      if (!mamasSnap.exists()) {
        await saveMamasSavingsToFirestore(adminUid, MAMAS_SAVINGS_DATA);
      }
    } catch {
      // Ignore if non-fatal
    }

    return { createdNew: false };
  }

  // Step 1: Create the parent ledger config document first so `isParentLedgerAdmin(ledgerId)` passes
  const configPayload = {
    ownerId: adminUid,
    clanName: (seedDb.clanName || INITIAL_EFUND_DB.clanName).trim().slice(0, 120),
    currency: 'PHP',
    cashReserveTarget: clampNumber(seedDb.cashReserveTarget ?? 15000, 0, 100000000),
    priorIncluded: Boolean(seedDb.priorBalanceForward?.included ?? false),
    priorLabel: (
      seedDb.priorBalanceForward?.label || INITIAL_EFUND_DB.priorBalanceForward.label
    )
      .trim()
      .slice(0, 120),
    priorDate: (seedDb.priorBalanceForward?.date || '2024-01-01').trim().slice(0, 32),
    priorAmountOnHand: clampNumber(
      seedDb.priorBalanceForward?.amountOnHand ?? 0,
      -100000000,
      100000000
    ),
    priorBpiMoneyMarket: clampNumber(
      seedDb.priorBalanceForward?.bpiMoneyMarket ?? 0,
      -100000000,
      100000000
    ),
    priorBpiShortTerm: clampNumber(
      seedDb.priorBalanceForward?.bpiShortTerm ?? 0,
      -100000000,
      100000000
    ),
    members: sanitizeMembersList(seedDb.members || INITIAL_EFUND_DB.members),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(ledgerRef, configPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, ledgerPath);
  }

  // Step 2: Seed all 107 transactions into `/ledgers/clan-efund-main/transactions` in safe chunks
  const txsToSeed =
    seedDb.transactions && seedDb.transactions.length >= INITIAL_EFUND_DB.transactions.length
      ? seedDb.transactions
      : INITIAL_EFUND_DB.transactions;

  const CHUNK_SIZE = 250;
  for (let i = 0; i < txsToSeed.length; i += CHUNK_SIZE) {
    const chunk = txsToSeed.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((tx, idx) => {
      const docId = sanitizeDocId(tx.id || `row-${tx.rowRef ?? 4 + i + idx}`);
      const txRef = doc(db, 'ledgers', SHARED_LEDGER_ID, 'transactions', docId);
      batch.set(txRef, buildTransactionCreatePayload(adminUid, tx, tx.rowRef ?? 4 + i + idx));
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ledgers/${SHARED_LEDGER_ID}/transactions`);
    }
  }

  // Step 3: Seed Mama's Personal Savings into `/mamas_savings/state` only if it does not already exist
  try {
    const mamasRef = doc(db, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);
    const mamasSnap = await getDoc(mamasRef);
    if (!mamasSnap.exists()) {
      await saveMamasSavingsToFirestore(adminUid, MAMAS_SAVINGS_DATA);
    }
  } catch {
    // Non-fatal
  }

  return { createdNew: true };
}

/**
 * Subscribes to real-time updates on `/ledgers/clan-efund-main` and `/ledgers/clan-efund-main/transactions`.
 * Works for both the Admin (read/write) and View-Only Contributors (read-only).
 */
export function subscribeToSharedLedger(
  onUpdate: (data: Partial<ClanEFundDatabase>) => void,
  onError?: (errMessage: string) => void
): () => void {
  const ledgerPath = `ledgers/${SHARED_LEDGER_ID}`;
  const txCollectionPath = `ledgers/${SHARED_LEDGER_ID}/transactions`;
  const ledgerRef = doc(db, 'ledgers', SHARED_LEDGER_ID);
  const txQuery = query(
    collection(db, 'ledgers', SHARED_LEDGER_ID, 'transactions'),
    where('ledgerId', '==', SHARED_LEDGER_ID)
  );

  let latestConfig: Partial<ClanEFundDatabase> | null = null;
  let latestTransactions: EFundTransaction[] | null = null;
  let parentExists = false;

  const emitIfReady = () => {
    if (!parentExists) return;
    if (!latestConfig && !latestTransactions) return;
    // Prevent overwriting the full migrated dataset with a legacy pre-Excel 20-row snapshot
    if (
      latestTransactions &&
      latestTransactions.length > 0 &&
      latestTransactions.length <= 25
    ) {
      return;
    }
    const merged: Partial<ClanEFundDatabase> = {
      ...(latestConfig || {}),
      ...(latestTransactions ? { transactions: latestTransactions } : {})
    };
    onUpdate(merged);
  };

  const unsubLedger = onSnapshot(
    ledgerRef,
    (snap) => {
      if (!snap.exists()) {
        parentExists = false;
        return;
      }
      parentExists = true;
      const d = snap.data();
      const updatedIso =
        d.updatedAt && typeof d.updatedAt.toDate === 'function'
          ? d.updatedAt.toDate().toISOString()
          : new Date().toISOString();

      latestConfig = {
        clanName: d.clanName || INITIAL_EFUND_DB.clanName,
        currency: d.currency || 'PHP',
        lastUpdated: updatedIso,
        cashReserveTarget:
          typeof d.cashReserveTarget === 'number' ? d.cashReserveTarget : 15000,
        members: Array.isArray(d.members) ? d.members : INITIAL_EFUND_DB.members,
        priorBalanceForward: {
          included: typeof d.priorIncluded === 'boolean' ? d.priorIncluded : true,
          label: d.priorLabel || INITIAL_EFUND_DB.priorBalanceForward.label,
          date: d.priorDate || INITIAL_EFUND_DB.priorBalanceForward.date,
          amountOnHand:
            typeof d.priorAmountOnHand === 'number'
              ? d.priorAmountOnHand
              : INITIAL_EFUND_DB.priorBalanceForward.amountOnHand,
          bpiMoneyMarket:
            typeof d.priorBpiMoneyMarket === 'number'
              ? d.priorBpiMoneyMarket
              : INITIAL_EFUND_DB.priorBalanceForward.bpiMoneyMarket,
          bpiShortTerm:
            typeof d.priorBpiShortTerm === 'number'
              ? d.priorBpiShortTerm
              : INITIAL_EFUND_DB.priorBalanceForward.bpiShortTerm,
          notes: INITIAL_EFUND_DB.priorBalanceForward.notes
        }
      };
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, ledgerPath);
      } catch (e: any) {
        onError?.(e?.message || 'Failed to listen to ledger configuration.');
      }
    }
  );

  const unsubTransactions = onSnapshot(
    txQuery,
    (qSnap) => {
      let needsLegacyLoanFix = false;
      const rowsToPatchInFirestore: EFundTransaction[] = [];

      const rows: EFundTransaction[] = qSnap.docs.map((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id;
        let category: EntryCategory = VALID_CATEGORIES.includes(d.category)
          ? d.category
          : 'Contribution';
        const amountOnHand = typeof d.amountOnHand === 'number' ? d.amountOnHand : 0;
        const bpiMoneyMarket = typeof d.bpiMoneyMarket === 'number' ? d.bpiMoneyMarket : 0;
        const bpiShortTerm = typeof d.bpiShortTerm === 'number' ? d.bpiShortTerm : 0;
        let memberLoan = typeof d.memberLoan === 'number' ? d.memberLoan : 0;
        let highlightAlert = Boolean(d.highlightAlert);
        const descLower = String(d.description || '').toLowerCase();
        const memberLower = String(d.memberOrBeneficiary || '').toLowerCase();

        // Automatically upgrade legacy Dondon loan & repayment rows that were originally seeded as Medical Disbursement / Reimbursement,
        // and repair any Member Loan / Loan Repayment row where memberLoan was left at 0 during a manual category edit.
        const absCashAndBank = Math.abs(amountOnHand + bpiMoneyMarket + bpiShortTerm);
        if (
          ((id === 'row-36' || descLower.includes('hiram ni dondon')) &&
            category === 'Medical Disbursement') ||
          (category === 'Member Loan' && memberLoan === 0 && absCashAndBank > 0)
        ) {
          category = 'Member Loan';
          memberLoan = absCashAndBank;
          highlightAlert = false;
          needsLegacyLoanFix = true;
        } else if (
          ((id === 'row-43' ||
            id === 'row-90' ||
            id === 'row-109' ||
            (memberLower === 'dondon' &&
              (descLower.includes('partial payment') ||
                descLower.includes("dondon's payment") ||
                descLower.includes('dondon payment')))) &&
            category === 'Reimbursement') ||
          (category === 'Loan Repayment' && memberLoan === 0 && absCashAndBank > 0)
        ) {
          category = 'Loan Repayment';
          memberLoan = -absCashAndBank;
          highlightAlert = false;
          needsLegacyLoanFix = true;
        }

        const rowObj: EFundTransaction = {
          id,
          rowRef: typeof d.rowRef === 'number' ? d.rowRef : undefined,
          date: d.date || '2026-04-27',
          displayDate: d.displayDate || d.date || '4/27/2026',
          description: d.description || '',
          category,
          memberOrBeneficiary: d.memberOrBeneficiary || '',
          amountOnHand,
          bpiMoneyMarket,
          bpiShortTerm,
          memberLoan,
          highlightAlert,
          notes: d.notes || ''
        };

        if (
          d.category !== category ||
          (typeof d.memberLoan === 'number' ? d.memberLoan : 0) !== memberLoan
        ) {
          rowsToPatchInFirestore.push(rowObj);
        }

        return rowObj;
      });

      if (
        needsLegacyLoanFix &&
        rowsToPatchInFirestore.length > 0 &&
        auth.currentUser &&
        isLedgerAdmin(auth.currentUser)
      ) {
        const adminUid = auth.currentUser.uid;
        rowsToPatchInFirestore.forEach((tx) => {
          saveTransactionToFirestore(adminUid, tx, tx.id, tx.rowRef ?? 100).catch(() => {
            // Ignore non-fatal background migration errors
          });
        });
      }

      rows.sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        const rA = a.rowRef ?? 999999;
        const rB = b.rowRef ?? 999999;
        return rA - rB;
      });

      latestTransactions = rows;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, txCollectionPath);
      } catch (e: any) {
        onError?.(e?.message || 'Failed to listen to transactions subcollection.');
      }
    }
  );

  return () => {
    unsubLedger();
    unsubTransactions();
  };
}

export async function updateLedgerConfigInFirestore(
  config: {
    clanName: string;
    cashReserveTarget: number;
    priorBalanceForward: ClanEFundDatabase['priorBalanceForward'];
    members: string[];
  }
): Promise<void> {
  const ledgerPath = `ledgers/${SHARED_LEDGER_ID}`;
  const ledgerRef = doc(db, 'ledgers', SHARED_LEDGER_ID);

  try {
    await setDoc(
      ledgerRef,
      {
        clanName: (config.clanName || INITIAL_EFUND_DB.clanName).trim().slice(0, 120),
        currency: 'PHP',
        cashReserveTarget: clampNumber(config.cashReserveTarget ?? 15000, 0, 100000000),
        priorIncluded: Boolean(config.priorBalanceForward.included),
        priorLabel: (
          config.priorBalanceForward.label || INITIAL_EFUND_DB.priorBalanceForward.label
        )
          .trim()
          .slice(0, 120),
        priorDate: (config.priorBalanceForward.date || '2026-04-26').trim().slice(0, 32),
        priorAmountOnHand: clampNumber(
          config.priorBalanceForward.amountOnHand,
          -100000000,
          100000000
        ),
        priorBpiMoneyMarket: clampNumber(
          config.priorBalanceForward.bpiMoneyMarket,
          -100000000,
          100000000
        ),
        priorBpiShortTerm: clampNumber(
          config.priorBalanceForward.bpiShortTerm,
          -100000000,
          100000000
        ),
        members: sanitizeMembersList(config.members),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ledgerPath);
  }
}

export async function saveTransactionToFirestore(
  adminUid: string,
  entryData: Omit<EFundTransaction, 'id'>,
  existingId?: string,
  fallbackRowRef = 112,
  assignedNewId?: string
): Promise<string> {
  const docId = sanitizeDocId(existingId || assignedNewId || `row-${Date.now()}`);
  const txPath = `ledgers/${SHARED_LEDGER_ID}/transactions/${docId}`;
  const txRef = doc(db, 'ledgers', SHARED_LEDGER_ID, 'transactions', docId);

  if (existingId) {
    try {
      await setDoc(
        txRef,
        {
          ...buildTransactionUpdatePayload(entryData, fallbackRowRef),
          ledgerId: SHARED_LEDGER_ID,
          ownerId: adminUid
        },
        { merge: true }
      );
      return docId;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, txPath);
    }
  } else {
    try {
      await setDoc(txRef, buildTransactionCreatePayload(adminUid, entryData, fallbackRowRef));
      return docId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, txPath);
    }
  }
}

export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  const docId = sanitizeDocId(transactionId);
  const txPath = `ledgers/${SHARED_LEDGER_ID}/transactions/${docId}`;
  const txRef = doc(db, 'ledgers', SHARED_LEDGER_ID, 'transactions', docId);

  try {
    await deleteDoc(txRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, txPath);
  }
}

/**
 * Replaces the entire shared Firestore ledger configuration and transactions subcollection
 * with `targetDb` (Admin-only operation).
 */
export async function replaceEntireLedgerInFirestore(
  adminUid: string,
  targetDb: ClanEFundDatabase
): Promise<void> {
  const ledgerRef = doc(db, 'ledgers', SHARED_LEDGER_ID);
  let snap;
  try {
    snap = await getDoc(ledgerRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `ledgers/${SHARED_LEDGER_ID}`);
  }

  if (!snap || !snap.exists()) {
    await ensureSharedLedgerInitializedInFirestore(adminUid, targetDb);
    return;
  }

  const configPayload = {
    ownerId: adminUid,
    clanName: (targetDb.clanName || INITIAL_EFUND_DB.clanName).trim().slice(0, 120),
    currency: 'PHP',
    cashReserveTarget: clampNumber(targetDb.cashReserveTarget ?? 15000, 0, 100000000),
    priorIncluded: Boolean(
      (targetDb.priorBalanceForward || INITIAL_EFUND_DB.priorBalanceForward).included
    ),
    priorLabel: (
      targetDb.priorBalanceForward?.label || INITIAL_EFUND_DB.priorBalanceForward.label
    )
      .trim()
      .slice(0, 120),
    priorDate: (targetDb.priorBalanceForward?.date || '2024-01-01').trim().slice(0, 32),
    priorAmountOnHand: clampNumber(
      targetDb.priorBalanceForward?.amountOnHand ?? 0,
      -100000000,
      100000000
    ),
    priorBpiMoneyMarket: clampNumber(
      targetDb.priorBalanceForward?.bpiMoneyMarket ?? 0,
      -100000000,
      100000000
    ),
    priorBpiShortTerm: clampNumber(
      targetDb.priorBalanceForward?.bpiShortTerm ?? 0,
      -100000000,
      100000000
    ),
    members: sanitizeMembersList(targetDb.members || INITIAL_EFUND_DB.members),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(ledgerRef, configPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `ledgers/${SHARED_LEDGER_ID}`);
  }

  const txQuery = query(
    collection(db, 'ledgers', SHARED_LEDGER_ID, 'transactions'),
    where('ledgerId', '==', SHARED_LEDGER_ID)
  );

  let existingDocs;
  try {
    existingDocs = await getDocs(txQuery);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `ledgers/${SHARED_LEDGER_ID}/transactions`);
  }

  const CHUNK_SIZE = 250;
  if (existingDocs && existingDocs.docs.length > 0) {
    const docsToDelete = existingDocs.docs;
    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      const deleteBatch = writeBatch(db);
      chunk.forEach((d) => {
        deleteBatch.delete(d.ref);
      });
      try {
        await deleteBatch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `ledgers/${SHARED_LEDGER_ID}/transactions`);
      }
    }
  }

  const txsToCreate = targetDb.transactions || [];
  for (let i = 0; i < txsToCreate.length; i += CHUNK_SIZE) {
    const chunk = txsToCreate.slice(i, i + CHUNK_SIZE);
    const createBatch = writeBatch(db);
    chunk.forEach((tx, idx) => {
      const docId = sanitizeDocId(tx.id || `row-${tx.rowRef ?? 4 + i + idx}`);
      const txRef = doc(db, 'ledgers', SHARED_LEDGER_ID, 'transactions', docId);
      createBatch.set(txRef, buildTransactionCreatePayload(adminUid, tx, tx.rowRef ?? 4 + i + idx));
    });

    try {
      await createBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ledgers/${SHARED_LEDGER_ID}/transactions`);
    }
  }
}



export function normalizeMamasBucketLabels(raw?: Partial<MamasBucketLabels>): MamasBucketLabels {
  const rawInvest = (raw?.investLabel || '').trim();
  const investLabel =
    !rawInvest || /^invest fund( reserve)?$/i.test(rawInvest)
      ? DEFAULT_MAMAS_BUCKET_LABELS.investLabel
      : rawInvest.slice(0, 60);
  const atmLabel = (raw?.atmLabel || '').trim().slice(0, 60) || DEFAULT_MAMAS_BUCKET_LABELS.atmLabel;
  const loanLabel =
    (raw?.loanLabel || '').trim().slice(0, 60) || DEFAULT_MAMAS_BUCKET_LABELS.loanLabel;

  return {
    investLabel,
    atmLabel,
    loanLabel
  };
}

export function normalizeMamasCustomBuckets(raw?: any[]): MamasCustomBucket[] {
  if (!Array.isArray(raw)) return [];
  const validCategories: MamasBucketCategory[] = ['investment', 'liquid_cash', 'receivable'];
  const seen = new Set<string>();
  const result: MamasCustomBucket[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const label = String(item.label || '').trim().slice(0, 60);
    if (!label) continue;
    const id =
      String(item.id || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 48) ||
      `bucket_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const category: MamasBucketCategory = validCategories.includes(item.category)
      ? item.category
      : 'investment';
    const description = item.description ? String(item.description).trim().slice(0, 120) : undefined;

    result.push({
      id,
      label,
      category,
      ...(description ? { description } : {})
    });
  }

  return result.slice(0, 20);
}

export async function saveMamasSavingsToFirestore(
  adminUid: string,
  state: MamasSavingsState
): Promise<void> {
  const docPath = `mamas_savings/${MAMAS_SAVINGS_DOC_ID}`;
  const docRef = doc(db, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);
  const bucketLabels = normalizeMamasBucketLabels(state.bucketLabels);
  const customBuckets = normalizeMamasCustomBuckets(state.customBuckets);

  try {
    await setDoc(docRef, {
      ownerId: adminUid,
      title: (state.title || "Mama's Savings").trim().slice(0, 120) || "Mama's Savings",
      investBalance: clampNumber(state.investBalance, -100000000, 100000000),
      mamaAtmBalance: clampNumber(state.mamaAtmBalance, -100000000, 100000000),
      loanToMhariz: clampNumber(state.loanToMhariz, -100000000, 100000000),
      totalSavings: clampNumber(state.totalSavings, -100000000, 100000000),
      bucketLabels,
      customBuckets,
      records: state.records.slice(0, 2000).map((r, i) => ({
        id: String(r.id || `mamas-row-${r.rowRef ?? i + 1}-${r.date}`).slice(0, 64),
        rowRef: r.rowRef ?? i + 1,
        date: r.date,
        displayDate: r.displayDate || r.date,
        invest: clampNumber(r.invest, -100000000, 100000000),
        mamaAtm: clampNumber(r.mamaAtm, -100000000, 100000000),
        ...(r.customBucketId
          ? {
              customBucketId: String(r.customBucketId).slice(0, 48),
              customAmount: clampNumber(r.customAmount || 0, -100000000, 100000000)
            }
          : {}),
        notes: (r.notes || '').slice(0, 500)
      })),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

export function formatIsoOrSerialDate(isoDate?: string, rawDisplayDate?: string): string {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) {
    const [y, m, d] = isoDate.trim().split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }
  const serial = Number(rawDisplayDate || isoDate);
  if (Number.isFinite(serial) && serial > 40000 && serial < 60000) {
    const utcDays = Math.floor(serial - 25569);
    const dt = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }
  return rawDisplayDate || isoDate || '—';
}

export function defaultMamasRecordNote(
  invest: number,
  mamaAtm: number,
  rawNote: string | undefined,
  isoDate: string | undefined,
  bucketLabels: MamasBucketLabels,
  customBucketId?: string,
  customAmount?: number,
  customBuckets: MamasCustomBucket[] = []
): string {
  const trimmed = (rawNote || '')
    .trim()
    .replace(/Invest Fund Reserve/gi, bucketLabels.investLabel)
    .replace(/Invest Fund/gi, bucketLabels.investLabel);
  if (trimmed) return trimmed;
  if (customBucketId) {
    const found = customBuckets.find((b) => b.id === customBucketId);
    const label = found?.label || 'Custom Bucket';
    return (customAmount || 0) >= 0
      ? `Allocation to ${label}`
      : `${label} withdrawal`;
  }
  if (invest === -40000 || (isoDate === '2026-08-04' && invest < 0)) {
    return `${bucketLabels.loanLabel} (Loan from ${bucketLabels.investLabel})`;
  }
  if (invest > 0 && mamaAtm === 0) return `Monthly allocation to ${bucketLabels.investLabel}`;
  if (invest < 0 && mamaAtm === 0) return `${bucketLabels.investLabel} withdrawal / disbursement`;
  if (mamaAtm > 0 && invest === 0) return `Monthly deposit to ${bucketLabels.atmLabel}`;
  if (mamaAtm < 0 && invest === 0) return `${bucketLabels.atmLabel} cash withdrawal`;
  return "Mama's Savings transaction";
}

export function subscribeToMamasSavings(
  onUpdate: (data: MamasSavingsState) => void,
  onError?: (errMessage: string) => void
): () => void {
  const docPath = `mamas_savings/${MAMAS_SAVINGS_DOC_ID}`;
  const docRef = doc(db, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);

  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(MAMAS_SAVINGS_DATA);
        return;
      }
      const d = snap.data();
      let needsFirestoreCleanup = false;
      const bucketLabels = normalizeMamasBucketLabels(d.bucketLabels);
      const customBuckets = normalizeMamasCustomBuckets(d.customBuckets);
      if (
        !d.bucketLabels ||
        d.bucketLabels.investLabel !== bucketLabels.investLabel ||
        d.bucketLabels.atmLabel !== bucketLabels.atmLabel ||
        d.bucketLabels.loanLabel !== bucketLabels.loanLabel
      ) {
        needsFirestoreCleanup = true;
      }

      const records = Array.isArray(d.records)
        ? d.records.map((r: any, idx: number) => {
            const isoDate = r.date || '2026-04-27';
            const invest = typeof r.invest === 'number' ? r.invest : 0;
            const mamaAtm = typeof r.mamaAtm === 'number' ? r.mamaAtm : 0;
            const customBucketId =
              typeof r.customBucketId === 'string' && r.customBucketId.trim()
                ? r.customBucketId.trim()
                : undefined;
            const customAmount =
              typeof r.customAmount === 'number' ? r.customAmount : undefined;
            const cleanDisplayDate = formatIsoOrSerialDate(isoDate, r.displayDate);
            const cleanNotes = defaultMamasRecordNote(
              invest,
              mamaAtm,
              r.notes,
              isoDate,
              bucketLabels,
              customBucketId,
              customAmount,
              customBuckets
            );
            const hasRawSerialDate =
              Number.isFinite(Number(r.displayDate)) && Number(r.displayDate) > 40000;
            const hasLegacyInvestNote = /Invest Fund/i.test(String(r.notes || ''));
            if (hasRawSerialDate || hasLegacyInvestNote || !r.notes) {
              needsFirestoreCleanup = true;
            }
            return {
              id: r.id || `mamas-row-${r.rowRef ?? idx + 1}-${isoDate}`,
              rowRef: typeof r.rowRef === 'number' ? r.rowRef : idx + 1,
              date: isoDate,
              displayDate: cleanDisplayDate,
              invest,
              mamaAtm,
              ...(customBucketId
                ? { customBucketId, customAmount: customAmount || 0 }
                : {}),
              notes: cleanNotes
            };
          })
        : MAMAS_SAVINGS_DATA.records;

      const normalizedState: MamasSavingsState = {
        title: d.title || MAMAS_SAVINGS_DATA.title,
        investBalance: typeof d.investBalance === 'number' ? d.investBalance : MAMAS_SAVINGS_DATA.investBalance,
        mamaAtmBalance: typeof d.mamaAtmBalance === 'number' ? d.mamaAtmBalance : MAMAS_SAVINGS_DATA.mamaAtmBalance,
        loanToMhariz: typeof d.loanToMhariz === 'number' ? d.loanToMhariz : MAMAS_SAVINGS_DATA.loanToMhariz,
        totalSavings: typeof d.totalSavings === 'number' ? d.totalSavings : MAMAS_SAVINGS_DATA.totalSavings,
        bucketLabels,
        customBuckets,
        lastUpdated: d.updatedAt && typeof d.updatedAt.toDate === 'function' ? d.updatedAt.toDate().toISOString() : undefined,
        records
      };

      if (needsFirestoreCleanup && auth.currentUser && isLedgerAdmin(auth.currentUser)) {
        saveMamasSavingsToFirestore(auth.currentUser.uid, normalizedState).catch(() => {
          // Ignore background cleanup errors
        });
      }

      onUpdate(normalizedState);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, docPath);
      } catch (e: any) {
        onError?.(e?.message || "Failed to load Mama's Savings from Firestore.");
      }
    }
  );
}


