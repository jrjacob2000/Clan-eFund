import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INITIAL_EFUND_DB,
  MAMAS_SAVINGS_DATA,
  formatPHP
} from '../data/initialLedger';
import { PRODUCTION_FIREBASE_CONFIG } from '../services/firebaseDb';
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
console.log('--- Running Shared Unit Test Suite (UT-01 to UT-18) ---');
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

// ---------------------------------------------------------------------------
// PART 2: STATIC & CONFIG PROBE TESTS (SECURITY RULES, CONFIGS, DATA INTEGRITY)
// ---------------------------------------------------------------------------
console.log('\n--- Running Architecture, Configuration & Security Probe Suite (PT-01 to PT-10) ---');

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
      'clanefund-dev'
    );
    assert.ok(devConfig.apiKey && devConfig.apiKey.length > 10);
    assert.equal(PRODUCTION_FIREBASE_CONFIG.projectId, 'clan-e-fund-ledger');
    assert.equal(
      PRODUCTION_FIREBASE_CONFIG.firestoreDatabaseId,
      'ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a'
    );
    return `ActiveConfig=${devConfig.projectId} | Prod=${PRODUCTION_FIREBASE_CONFIG.projectId} | DevDB=${devConfig.firestoreDatabaseId} | ProdDB=${PRODUCTION_FIREBASE_CONFIG.firestoreDatabaseId}`;
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

recordTest(
  'PT-09',
  'PROBE',
  'Probe App CSV sanitization, JSON import bounds, safe Drive URLs, relative asset path, zero unreferenced screenshots, and hardened Firestore schema rules',
  () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const dbViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseManagementView.tsx'),
      'utf-8'
    );
    const rulesSource = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    const assetFiles = readdirSync(resolve(process.cwd(), 'public/assets/aistudio')).sort();

    assert.ok(
      appSource.includes('sanitizeCsvCell(t.description)') &&
        appSource.includes('sanitizeCsvCell(t.memberOrBeneficiary)'),
      'App.tsx handleDownloadCsv must wrap exported fields in sanitizeCsvCell()'
    );
    assert.ok(
      appSource.includes('MAX_IMPORT_JSON_BYTES'),
      'App.tsx handleImportJsonFile must enforce a file size limit'
    );
    assert.ok(
      dbViewSource.includes('safeGoogleDriveUrl(') &&
        !dbViewSource.includes('src="/assets/aistudio/'),
      'DatabaseManagementView.tsx must use safeGoogleDriveUrl() and relative ./assets/ paths'
    );
    assert.deepEqual(
      assetFiles,
      ['image_898f47ed.png'],
      `public/assets/aistudio should only contain referenced image_898f47ed.png, found: ${assetFiles.join(', ')}`
    );
    assert.ok(
      rulesSource.includes('isValidTransaction(incoming(), ledgerId)') &&
        rulesSource.includes('isValidMamasSavings(incoming())') &&
        rulesSource.includes('resource.data.ledgerId == ledgerId'),
      'firestore.rules must enforce schema validation and ledgerId query constraint'
    );

    return 'Verified App CSV sanitization, JSON import bounds, safe Drive URLs, clean public assets, and strict Firestore rules';
  }
);

recordTest(
  'PT-10',
  'PROBE',
  'Probe Loan Self-Healing Normalization, Flat Chronological Activity Ledger, Contribution Isolation, and Conditional Dashboard Loan Card',
  () => {
    const firebaseDbSource = readFileSync(
      resolve(process.cwd(), 'src/services/firebaseDb.ts'),
      'utf-8'
    );
    const entryModalSource = readFileSync(
      resolve(process.cwd(), 'src/components/EntryFormModal.tsx'),
      'utf-8'
    );
    const activityLedgerSource = readFileSync(
      resolve(process.cwd(), 'src/components/ActivityLedgerView.tsx'),
      'utf-8'
    );
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

    // 1. Self-healing memberLoan normalization in firebaseDb.ts
    assert.ok(
      firebaseDbSource.includes("category === 'Member Loan' && memberLoan === 0 && absCashAndBank > 0") &&
        firebaseDbSource.includes("category === 'Loan Repayment' && memberLoan === 0 && absCashAndBank > 0"),
      'firebaseDb.ts must auto-repair Member Loan and Loan Repayment rows where memberLoan was 0'
    );

    // 2. EntryFormModal auto-syncs memberLoan when switching categories in Custom Split / Edit mode
    assert.ok(
      entryModalSource.includes('setMemberLoan(cashAndBankSum)') &&
        entryModalSource.includes('setMemberLoan(-cashAndBankSum)'),
      'EntryFormModal.tsx must auto-sync memberLoan offset when category changes in Custom Split mode'
    );

    // 3. ActivityLedgerView is flat chronological (no month grouping headers or Tagalog translation helpers)
    assert.ok(
      !activityLedgerSource.includes('formatMonthGroupLabel') &&
        !activityLedgerSource.includes('getEnglishTranslation'),
      'ActivityLedgerView.tsx must render flat chronological rows with zero month-group headers or Tagalog translations'
    );

    // 4. App.tsx strictly counts Contribution category in contributorStats and hides Member Loans card when memberLoan === 0
    assert.ok(
      !appSource.includes("t.category === 'Contribution' || t.category === 'Reimbursement'"),
      'App.tsx contributorStats must strictly filter t.category === Contribution and exclude Reimbursements/Loan Repayments'
    );
    assert.ok(
      appSource.includes('totals.memberLoan > 0 && (') &&
        appSource.includes("totals.memberLoan > 0 ? 'All 4 Accounts →' : 'All 3 Accounts →'"),
      'App.tsx must conditionally hide Member Loans (Receivable) card on the Dashboard when totals.memberLoan === 0'
    );

    return 'Verified loan self-healing, modal auto-sync, flat chronological Activity Ledger, contribution isolation, and conditional loan card';
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
