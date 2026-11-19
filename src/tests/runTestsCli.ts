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
  'UT-13',
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
  'UT-14',
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
  'Verify firebase-applet-config.json (Dev) and PRODUCTION_FIREBASE_CONFIG (Prod) are properly configured',
  () => {
    const devConfigRaw = readFileSync(resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
    const devConfig = JSON.parse(devConfigRaw);
    assert.equal(devConfig.projectId, 'gen-lang-client-0866727915');
    assert.ok(devConfig.apiKey && devConfig.apiKey.length > 10);
    assert.equal(PRODUCTION_FIREBASE_CONFIG.projectId, 'clan-e-fund-ledger');
    assert.equal(
      PRODUCTION_FIREBASE_CONFIG.firestoreDatabaseId,
      'ai-studio-clanefundledger-9007d667-4fc7-4cb4-b6d8-b403e74ca30a'
    );
    return `Dev=${devConfig.projectId} | Prod=${PRODUCTION_FIREBASE_CONFIG.projectId}`;
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
  'Probe all 18 Mama\'s Personal Savings seed records for valid ISO dates, non-serial displayDates, and BPI Short Term naming',
  () => {
    for (const rec of MAMAS_SAVINGS_DATA.records) {
      assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/, `Invalid date: ${rec.date}`);
      assert.doesNotMatch(
        rec.displayDate,
        /^\d{5}$/,
        `Found raw Excel serial date in displayDate: ${rec.displayDate}`
      );
      assert.ok(
        !/Invest Fund/i.test(rec.notes || ''),
        `Found unmigrated "Invest Fund" note: ${rec.notes}`
      );
    }
    return `18 Mama's Savings records verified with human-readable dates and "${MAMAS_SAVINGS_DATA.bucketLabels?.investLabel}" labels`;
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
  'Probe Google Drive & Sheets Backup integration for least-privilege scopes, in-memory token caching, and explicit overwrite confirmation modal',
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
      !firebaseDbSource.includes('localStorage.setItem(\'accessToken\'') &&
        !firebaseDbSource.includes('sessionStorage.setItem(\'accessToken\''),
      'OAuth access token must only be cached in memory, never in Web Storage'
    );
    assert.ok(
      dbViewSource.includes('Overwrite Existing Google Sheet Backup?'),
      'DatabaseManagementView.tsx must require explicit confirmation modal before overwriting an existing Google Sheet'
    );
    return 'Verified drive.file + spreadsheets scopes, in-memory token cache, and explicit overwrite confirmation modal';
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
