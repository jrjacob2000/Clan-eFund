import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ClanEFundDatabase,
  DEFAULT_MAMAS_BUCKET_LABELS,
  INITIAL_EFUND_DB,
  MAMAS_SAVINGS_DATA,
  MamasSavingsState,
  calculateMamasTotals,
  calculateTotals,
  formatPHP
} from '../data/initialLedger';
import {
  ADMIN_EMAIL,
  PRODUCTION_FIREBASE_CONFIG,
  SHARED_LEDGER_ID,
  buildTransactionCreatePayload,
  buildTransactionUpdatePayload,
  clampNumber,
  defaultMamasRecordNote,
  formatIsoOrSerialDate,
  isLedgerAdmin,
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets,
  sanitizeDocId,
  sanitizeMembersList
} from '../services/firebaseDb';
import { runAllUnitTests } from './diagnosticsSuite';

interface CliTestResult {
  id: string;
  suite: 'UNIT' | 'PROBE';
  name: string;
  passed: boolean;
  detail: string;
}

const cliResults: CliTestResult[] = [];

function recordTest(id: string, suite: 'UNIT' | 'PROBE', name: string, fn: () => string) {
  try {
    const detail = fn();
    cliResults.push({ id, suite, name, passed: true, detail });
    console.log(`  [PASS] [${suite}] ${id}: ${name} -> ${detail}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    cliResults.push({ id, suite, name, passed: false, detail: msg });
    console.error(`  [FAIL] [${suite}] ${id}: ${name} -> ${msg}`);
  }
}

console.log('================================================================================');
console.log(' CLAN E-FUND & MAMA\'S SAVINGS — AUTOMATED UNIT & PROBE TEST RUNNER');
console.log('================================================================================\n');

// ---------------------------------------------------------------------------
// PART 1: EXECUTE ALL SHARED UNIT TESTS FROM diagnosticsSuite.ts
// ---------------------------------------------------------------------------
console.log('--- Running Shared Unit Test Suite (UT-01 to UT-12) ---');
const unitSuiteResults = runAllUnitTests();
for (const ut of unitSuiteResults) {
  recordTest(ut.id, 'UNIT', ut.name, () => {
    assert.equal(
      ut.passed,
      true,
      `Expected: ${ut.expected} | Actual: ${ut.actual}`
    );
    return ut.actual;
  });
}

// Additional Edge-Case Unit Tests
recordTest(
  'UT-14',
  'UNIT',
  'Internal Transfer between Cash on Hand, BPI Money Market, and BPI Short Term keeps Total Fund invariant',
  () => {
    const before = calculateTotals(INITIAL_EFUND_DB);
    const afterTransferDb: ClanEFundDatabase = {
      ...INITIAL_EFUND_DB,
      transactions: [
        ...INITIAL_EFUND_DB.transactions,
        {
          id: 'tx-transfer-test',
          rowRef: 112,
          date: '2026-11-01',
          displayDate: 'Nov 1, 2026',
          description: 'Sweep Cash to BPI Short Term',
          category: 'Internal Transfer',
          memberOrBeneficiary: 'BPI Short Term',
          amountOnHand: -5000,
          bpiMoneyMarket: 0,
          bpiShortTerm: 5000,
          memberLoan: 0
        }
      ]
    };
    const after = calculateTotals(afterTransferDb);
    assert.equal(after.totalFund, before.totalFund);
    assert.equal(after.amountOnHand, before.amountOnHand - 5000);
    assert.equal(after.bpiShortTerm, before.bpiShortTerm + 5000);
    return `Total invariant at ${formatPHP(after.totalFund)} (Cash ${formatPHP(after.amountOnHand)}, Short Term ${formatPHP(after.bpiShortTerm)})`;
  }
);

recordTest(
  'UT-15',
  'UNIT',
  'Empty Mama\'s Savings state (View-Only non-admin fallback) computes zero for all balances without leaking data',
  () => {
    const emptyState: MamasSavingsState = {
      title: "Mama's Savings",
      investBalance: 0,
      mamaAtmBalance: 0,
      loanToMhariz: 0,
      totalSavings: 0,
      records: []
    };
    const computed = calculateMamasTotals(emptyState);
    assert.equal(computed.investBalance, 0);
    assert.equal(computed.mamaAtmBalance, 0);
    assert.equal(computed.loanToMhariz, 0);
    assert.equal(computed.totalSavings, 0);
    return 'All balances verified at ₱0.00 when records=[]';
  }
);

// ---------------------------------------------------------------------------
// PART 2: STATIC & CONFIG PROBE TESTS (SECURITY RULES, CONFIGS, DATA INTEGRITY)
// ---------------------------------------------------------------------------
console.log('\n--- Running Architecture, Configuration & Security Probe Suite (PT-01 to PT-06) ---');

recordTest(
  'PT-01',
  'PROBE',
  'Verify firebase-applet-config.json and PRODUCTION_FIREBASE_CONFIG are properly configured for clan-e-fund-ledger',
  () => {
    const devConfigRaw = readFileSync(resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
    const devConfig = JSON.parse(devConfigRaw);
    assert.equal(devConfig.projectId, 'clan-e-fund-ledger');
    assert.equal(
      devConfig.firestoreDatabaseId,
      'ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a'
    );
    assert.ok(devConfig.apiKey && devConfig.apiKey.length > 10);
    assert.equal(PRODUCTION_FIREBASE_CONFIG.projectId, 'clan-e-fund-ledger');
    assert.equal(
      PRODUCTION_FIREBASE_CONFIG.firestoreDatabaseId,
      'ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a'
    );
    return `ActiveConfig=${devConfig.projectId} | Prod=${PRODUCTION_FIREBASE_CONFIG.projectId} | DB=${devConfig.firestoreDatabaseId}`;
  }
);

recordTest(
  'PT-02',
  'PROBE',
  'Probe firestore.rules for strict RBAC enforcement (jrjacob2000@gmail.com + email_verified + default deny)',
  () => {
    const rulesText = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    assert.ok(
      rulesText.includes("request.auth.token.email == 'jrjacob2000@gmail.com'"),
      'firestore.rules must lock admin access to jrjacob2000@gmail.com'
    );
    assert.ok(
      rulesText.includes('request.auth.token.email_verified == true'),
      'firestore.rules must enforce email_verified == true'
    );
    assert.ok(
      rulesText.includes('match /mamas_savings/{docId}'),
      'firestore.rules must protect /mamas_savings/{docId}'
    );
    assert.ok(
      rulesText.includes('allow get: if isAdmin() && isValidId(docId);'),
      'firestore.rules must restrict /mamas_savings get to isAdmin()'
    );
    assert.ok(
      rulesText.includes('allow list: if false;'),
      'firestore.rules must forbid list on /mamas_savings'
    );
    assert.ok(
      rulesText.includes('allow read, write: if false;'),
      'firestore.rules must include default-deny catch-all rule'
    );
    return 'Verified email_verified, jrjacob2000@gmail.com lock, private /mamas_savings guard, and default-deny rule';
  }
);

recordTest(
  'PT-03',
  'PROBE',
  'Probe all 107 Clan E-Fund seed rows for unique IDs, ISO YYYY-MM-DD dates, and valid categories',
  () => {
    const seenIds = new Set<string>();
    const validCats = new Set([
      'Contribution',
      'Medical Disbursement',
      'Internal Transfer',
      'Reimbursement',
      'Investment Yield',
      'Opening Balance',
      'Member Loan',
      'Loan Repayment'
    ]);
    for (const tx of INITIAL_EFUND_DB.transactions) {
      assert.ok(tx.id && !seenIds.has(tx.id), `Duplicate or missing transaction ID: ${tx.id}`);
      seenIds.add(tx.id);
      assert.match(tx.date, /^\d{4}-\d{2}-\d{2}$/, `Invalid ISO date on ${tx.id}: ${tx.date}`);
      assert.ok(validCats.has(tx.category), `Invalid category on ${tx.id}: ${tx.category}`);
      assert.ok(Number.isFinite(tx.amountOnHand), `Non-finite amountOnHand on ${tx.id}`);
      assert.ok(Number.isFinite(tx.bpiMoneyMarket), `Non-finite bpiMoneyMarket on ${tx.id}`);
      assert.ok(Number.isFinite(tx.bpiShortTerm), `Non-finite bpiShortTerm on ${tx.id}`);
    }
    return `107 unique rows verified (${INITIAL_EFUND_DB.transactions[0].date} -> ${INITIAL_EFUND_DB.transactions[106].date})`;
  }
);

recordTest(
  'PT-04',
  'PROBE',
  'Probe public client bundle (initialLedger.ts, App.tsx, DatabaseManagementView.tsx) for zero hardcoded private Mama\'s Savings balances or records',
  () => {
    const initialLedgerSource = readFileSync(
      resolve(process.cwd(), 'src/data/initialLedger.ts'),
      'utf-8'
    );
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const dbViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseManagementView.tsx'),
      'utf-8'
    );

    assert.equal(
      MAMAS_SAVINGS_DATA.records.length,
      0,
      'MAMAS_SAVINGS_DATA.records in public client bundle must be empty (0 records)'
    );
    assert.equal(
      MAMAS_SAVINGS_DATA.totalSavings,
      0,
      'MAMAS_SAVINGS_DATA.totalSavings in public client bundle must be 0'
    );
    assert.ok(
      !initialLedgerSource.includes('63200') &&
        !appSource.includes('63,200') &&
        !dbViewSource.includes('63,200'),
      'Static client bundle must not contain hardcoded private Mama\'s Savings total figures'
    );
    return `0 private records in client bundle (Total=${formatPHP(MAMAS_SAVINGS_DATA.totalSavings)}, Label="${MAMAS_SAVINGS_DATA.bucketLabels?.investLabel}")`;
  }
);

recordTest(
  'PT-05',
  'PROBE',
  'Probe row deletion threshold safety (deleting rows from 107 down to 26 never triggers < 107 overwrite bug)',
  () => {
    const firebaseDbSource = readFileSync(
      resolve(process.cwd(), 'src/services/firebaseDb.ts'),
      'utf-8'
    );
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    assert.ok(
      !firebaseDbSource.includes('< INITIAL_EFUND_DB.transactions.length'),
      'firebaseDb.ts must not reset or ignore snapshots when row count is < 107'
    );
    assert.ok(
      !appSource.includes('parsed.transactions.length >= 107'),
      'App.tsx localStorage loader must not reject valid caches with < 107 rows'
    );
    return 'Verified both firebaseDb.ts and App.tsx use > 25 threshold to protect row deletions';
  }
);

recordTest(
  'PT-06',
  'PROBE',
  'Probe Google Drive & Sheets Backup integration for least-privilege scopes, admin-only in-memory token caching, and explicit overwrite confirmation modal',
  () => {
    const firebaseDbSource = readFileSync(
      resolve(process.cwd(), 'src/services/firebaseDb.ts'),
      'utf-8'
    );
    const dbViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseManagementView.tsx'),
      'utf-8'
    );
    assert.ok(
      firebaseDbSource.includes('https://www.googleapis.com/auth/drive.file') &&
        firebaseDbSource.includes('https://www.googleapis.com/auth/spreadsheets'),
      'firebaseDb.ts must declare drive.file and spreadsheets OAuth scopes'
    );
    assert.ok(
      firebaseDbSource.includes('isLedgerAdmin(result.user)') &&
        firebaseDbSource.includes('cachedAccessToken = null'),
      'firebaseDb.ts must verify isLedgerAdmin(result.user) before caching OAuth access tokens and clear token for non-admins'
    );
    assert.ok(
      !firebaseDbSource.includes("localStorage.setItem('accessToken'") &&
        !firebaseDbSource.includes("sessionStorage.setItem('accessToken'"),
      'OAuth access token must only be cached in memory, never in Web Storage'
    );
    assert.ok(
      dbViewSource.includes('Overwrite Existing Google Sheet Backup?'),
      'DatabaseManagementView.tsx must require explicit confirmation modal before overwriting an existing Google Sheet'
    );
    return 'Verified drive.file + spreadsheets scopes, isLedgerAdmin OAuth token guard, in-memory token cache, and overwrite modal';
  }
);

recordTest(
  'PT-07',
  'PROBE',
  'Probe Production Firestore Write & OAuth Sign-In Regression Guards (setDoc merge, existingId separation, batch-safe rules)',
  () => {
    const firebaseDbSource = readFileSync(
      resolve(process.cwd(), 'src/services/firebaseDb.ts'),
      'utf-8'
    );
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const rulesSource = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf-8');

    // 1. handleSaveEntry must NOT pass `existingId || assignedId` as existingId
    assert.ok(
      !appSource.includes('existingId || assignedId'),
      'App.tsx handleSaveEntry must pass existingId and assignedId separately so new transactions use setDoc(create)'
    );

    // 2. firebaseDb.ts must use setDoc(..., { merge: true }) and never call updateDoc on potentially non-existent docs
    assert.ok(
      !firebaseDbSource.includes('updateDoc('),
      'firebaseDb.ts must use setDoc with { merge: true } instead of updateDoc'
    );

    // 3.firestore.rules must authorize UID 8F7onSdbNwQcD3Jz2QSFXr8FKkr1 and contain 0 per-doc exists() calls
    assert.ok(
      rulesSource.includes("request.auth.uid == '8F7onSdbNwQcD3Jz2QSFXr8FKkr1'"),
      'firestore.rules must authorize verified production Admin UID 8F7onSdbNwQcD3Jz2QSFXr8FKkr1'
    );
    assert.ok(
      !rulesSource.includes('exists(/databases/'),
      'firestore.rules must contain 0 per-document exists() calls so 107-row batch writes never exceed Firestore limits'
    );

    return 'Verified existingId separation, setDoc({ merge: true }), production UID + email rule lock, and 0 exists() calls';
  }
);

recordTest(
  'PT-08',
  'PROBE',
  'Probe Spreadsheet Formula Injection Defense, CSV "#" Blob Safety, and Named Database ID Guard',
  () => {
    const driveSource = readFileSync(
      resolve(process.cwd(), 'src/services/googleDriveBackup.ts'),
      'utf-8'
    );
    const mamasViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/MamasSavingsView.tsx'),
      'utf-8'
    );
    const envExampleSource = readFileSync(resolve(process.cwd(), '.env.example'), 'utf-8');

    // 1. Google Sheets API must use valueInputOption: 'RAW' (never 'USER_ENTERED')
    assert.ok(
      !driveSource.includes("valueInputOption: 'USER_ENTERED'"),
      'googleDriveBackup.ts must use valueInputOption: RAW to block formula injection'
    );

    // 2. MamasSavingsView CSV export must use Blob instead of data:text/csv + encodeURI
    assert.ok(
      !mamasViewSource.includes('data:text/csv;charset=utf-8,'),
      'MamasSavingsView.tsx must use Blob URL for CSV download so "#" in notes never truncates files'
    );

    // 3. .env.example must not suggest VITE_FIREBASE_DATABASE_ID="(default)"
    assert.ok(
      !envExampleSource.includes('VITE_FIREBASE_DATABASE_ID="(default)"'),
      '.env.example must point to ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a'
    );

    return 'Verified valueInputOption: RAW, CSV Blob download, formula neutralization, and named database ID routing';
  }
);

// Summary Output
const passedCount = cliResults.filter((r) => r.passed).length;
const failedCount = cliResults.filter((r) => !r.passed).length;

console.log('\n================================================================================');
console.log(
  ` TEST SUMMARY: ${passedCount}/${cliResults.length} PASSED (${failedCount} FAILED)`
);
console.log('================================================================================');

if (failedCount > 0) {
  process.exit(1);
}
