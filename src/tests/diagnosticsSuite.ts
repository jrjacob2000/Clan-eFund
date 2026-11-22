import { doc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
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
  ACTIVE_FIREBASE_ENV,
  ADMIN_EMAIL,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  MAMAS_SAVINGS_CACHE_KEY,
  MAMAS_SAVINGS_DOC_ID,
  PRODUCTION_FIREBASE_CONFIG,
  SHARED_LEDGER_ID,
  WORKSPACE_SCOPES,
  auth,
  buildTransactionCreatePayload,
  buildTransactionUpdatePayload,
  clampNumber,
  db as firestoreDb,
  defaultMamasRecordNote,
  formatIsoOrSerialDate,
  isLedgerAdmin,
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets,
  sanitizeCsvCell,
  sanitizeDocId,
  sanitizeMembersList
} from '../services/firebaseDb';
import { buildSpreadsheetValueRanges, safeGoogleDriveUrl } from '../services/googleDriveBackup';

export interface TestCaseResult {
  id: string;
  suite: 'Unit Test' | 'Probe Test';
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  expected: string;
  actual: string;
  details?: string;
}

export interface DiagnosticSuiteReport {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  unitTests: TestCaseResult[];
  probeTests: TestCaseResult[];
}

function runSyncTest(
  id: string,
  suite: 'Unit Test' | 'Probe Test',
  category: string,
  name: string,
  fn: () => { passed: boolean; expected: string; actual: string; details?: string }
): TestCaseResult {
  const start = performance.now();
  try {
    const res = fn();
    const durationMs = Number((performance.now() - start).toFixed(2));
    return {
      id,
      suite,
      category,
      name,
      passed: res.passed,
      durationMs,
      expected: res.expected,
      actual: res.actual,
      details: res.details
    };
  } catch (err: any) {
    const durationMs = Number((performance.now() - start).toFixed(2));
    return {
      id,
      suite,
      category,
      name,
      passed: false,
      durationMs,
      expected: 'No uncaught exception',
      actual: err instanceof Error ? err.message : String(err),
      details: 'Exception thrown during test execution'
    };
  }
}

async function runAsyncTest(
  id: string,
  suite: 'Unit Test' | 'Probe Test',
  category: string,
  name: string,
  fn: () => Promise<{ passed: boolean; expected: string; actual: string; details?: string }>
): Promise<TestCaseResult> {
  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = Number((performance.now() - start).toFixed(2));
    return {
      id,
      suite,
      category,
      name,
      passed: res.passed,
      durationMs,
      expected: res.expected,
      actual: res.actual,
      details: res.details
    };
  } catch (err: any) {
    const durationMs = Number((performance.now() - start).toFixed(2));
    return {
      id,
      suite,
      category,
      name,
      passed: false,
      durationMs,
      expected: 'No uncaught exception',
      actual: err instanceof Error ? err.message : String(err),
      details: 'Exception thrown during async probe execution'
    };
  }
}

/**
 * Runs all synchronous deterministic Unit Tests covering:
 * - Currency formatting (`formatPHP`)
 * - 4-Bucket Clan E-Fund ledger math (`calculateTotals`, member loans, internal transfers, prior balance forward)
 * - Mama's Personal Savings math (`calculateMamasTotals`, loan outflow & repayment derivation, custom buckets)
 * - Dynamic Reference Data normalization (`normalizeMamasBucketLabels`, `normalizeMamasCustomBuckets`)
 * - Excel Serial & ISO Date formatting (`formatIsoOrSerialDate`, `defaultMamasRecordNote`)
 * - Security & RBAC unit checks (`isLedgerAdmin`, `sanitizeDocId`, `clampNumber`, `sanitizeMembersList`, Firestore payload builders)
 */
export function runAllUnitTests(): TestCaseResult[] {
  const results: TestCaseResult[] = [];

  // 1. formatPHP Currency Formatting
  results.push(
    runSyncTest(
      'UT-01',
      'Unit Test',
      'Currency & Formatting',
      'formatPHP formats positive, negative, and zero PHP amounts accurately',
      () => {
        const pos = formatPHP(96770);
        const neg = formatPHP(-3200.5);
        const zeroNormal = formatPHP(0, false);
        const zeroBlank = formatPHP(0, true);
        const passed =
          pos === '₱96,770.00' &&
          neg === '-₱3,200.50' &&
          zeroNormal === '₱0.00' &&
          zeroBlank === '—';
        return {
          passed,
          expected: '₱96,770.00 | -₱3,200.50 | ₱0.00 | —',
          actual: `${pos} | ${neg} | ${zeroNormal} | ${zeroBlank}`
        };
      }
    )
  );

  // 2. Master 107-Row Clan E-Fund Seed Verification
  results.push(
    runSyncTest(
      'UT-02',
      'Unit Test',
      'Clan E-Fund Accounting',
      'Master 107-row INITIAL_EFUND_DB reconciles to exact spreadsheet balances (₱96,770.00)',
      () => {
        const totals = calculateTotals(INITIAL_EFUND_DB);
        const rowCount = INITIAL_EFUND_DB.transactions.length;
        const passed =
          rowCount === 107 &&
          totals.amountOnHand === 11970 &&
          totals.bpiMoneyMarket === 78000 &&
          totals.bpiShortTerm === 6800 &&
          totals.memberLoan === 0 &&
          totals.totalFund === 96770;
        return {
          passed,
          expected: '107 rows | Cash ₱11,970 | MMF ₱78,000 | ST ₱6,800 | Total ₱96,770',
          actual: `${rowCount} rows | Cash ${formatPHP(totals.amountOnHand)} | MMF ${formatPHP(totals.bpiMoneyMarket)} | ST ${formatPHP(totals.bpiShortTerm)} | Total ${formatPHP(totals.totalFund)}`
        };
      }
    )
  );

  // 3. Prior Balance Forward Toggle Calculation
  results.push(
    runSyncTest(
      'UT-03',
      'Unit Test',
      'Clan E-Fund Accounting',
      'calculateTotals includes Prior Balance Forward only when priorBalanceForward.included is true',
      () => {
        const mockDb: ClanEFundDatabase = {
          ...INITIAL_EFUND_DB,
          priorBalanceForward: {
            included: true,
            label: 'Prior Carryover',
            date: '2024-01-01',
            amountOnHand: 5000,
            bpiMoneyMarket: 10000,
            bpiShortTerm: 2000,
            notes: ''
          },
          transactions: [
            {
              id: 't1',
              date: '2026-01-10',
              displayDate: 'Jan 10, 2026',
              description: 'Test Contribution',
              category: 'Contribution',
              memberOrBeneficiary: 'Jonathan',
              amountOnHand: 3000,
              bpiMoneyMarket: 0,
              bpiShortTerm: 0
            }
          ]
        };
        const withPrior = calculateTotals(mockDb);
        const withoutPrior = calculateTotals({
          ...mockDb,
          priorBalanceForward: { ...mockDb.priorBalanceForward, included: false }
        });
        const passed =
          withPrior.totalFund === 20000 &&
          withPrior.amountOnHand === 8000 &&
          withoutPrior.totalFund === 3000 &&
          withoutPrior.amountOnHand === 3000;
        return {
          passed,
          expected: 'Included: ₱20,000.00 (Cash ₱8,000) | Excluded: ₱3,000.00',
          actual: `Included: ${formatPHP(withPrior.totalFund)} (Cash ${formatPHP(withPrior.amountOnHand)}) | Excluded: ${formatPHP(withoutPrior.totalFund)}`
        };
      }
    )
  );

  // 4. Member Loan & Loan Repayment Zero-Net-Asset-Loss Verification
  results.push(
    runSyncTest(
      'UT-04',
      'Unit Test',
      'Clan E-Fund Accounting',
      'Member Loan outflow and Loan Repayment preserve Total Fund value while shifting Cash <-> Loan Receivable',
      () => {
        const baseDb: ClanEFundDatabase = {
          ...INITIAL_EFUND_DB,
          priorBalanceForward: { ...INITIAL_EFUND_DB.priorBalanceForward, included: false },
          transactions: [
            {
              id: 'seed-1',
              date: '2026-01-01',
              displayDate: 'Jan 1, 2026',
              description: 'Initial Cash',
              category: 'Contribution',
              memberOrBeneficiary: 'Nene',
              amountOnHand: 20000,
              bpiMoneyMarket: 0,
              bpiShortTerm: 0,
              memberLoan: 0
            },
            {
              id: 'loan-1',
              date: '2026-02-01',
              displayDate: 'Feb 1, 2026',
              description: 'Loan to Dondon',
              category: 'Member Loan',
              memberOrBeneficiary: 'Dondon',
              amountOnHand: -5000,
              bpiMoneyMarket: 0,
              bpiShortTerm: 0,
              memberLoan: 5000
            },
            {
              id: 'repay-1',
              date: '2026-03-01',
              displayDate: 'Mar 1, 2026',
              description: 'Partial Loan Repayment from Dondon',
              category: 'Loan Repayment',
              memberOrBeneficiary: 'Dondon',
              amountOnHand: 2000,
              bpiMoneyMarket: 0,
              bpiShortTerm: 0,
              memberLoan: -2000
            }
          ]
        };
        const totals = calculateTotals(baseDb);
        const passed =
          totals.amountOnHand === 17000 &&
          totals.memberLoan === 3000 &&
          totals.totalFund === 20000;
        return {
          passed,
          expected: 'Cash: ₱17,000.00 | Loan Receivable: ₱3,000.00 | Total Fund: ₱20,000.00',
          actual: `Cash: ${formatPHP(totals.amountOnHand)} | Loan Receivable: ${formatPHP(totals.memberLoan)} | Total Fund: ${formatPHP(totals.totalFund)}`
        };
      }
    )
  );

  // Synthetic test fixture for Mama's Savings unit tests (ensures zero real private figures exist in client bundle)
  const SYNTHETIC_MAMAS_FIXTURE: MamasSavingsState = {
    title: "Mama's Savings (Synthetic Test Fixture)",
    bucketLabels: { ...DEFAULT_MAMAS_BUCKET_LABELS },
    customBuckets: [],
    investBalance: 10000,
    mamaAtmBalance: 20000,
    loanToMhariz: 15000,
    totalSavings: 45000,
    records: [
      {
        id: 'syn-1',
        rowRef: 1,
        date: '2026-01-15',
        displayDate: 'Jan 15, 2026',
        invest: 12000,
        mamaAtm: 35000,
        notes: 'Synthetic opening deposit'
      },
      {
        id: 'syn-2',
        rowRef: 2,
        date: '2026-02-15',
        displayDate: 'Feb 15, 2026',
        invest: -2000,
        mamaAtm: 0,
        notes: 'Synthetic BPI Short Term withdrawal'
      },
      {
        id: 'syn-3',
        rowRef: 3,
        date: '2026-03-15',
        displayDate: 'Mar 15, 2026',
        invest: 0,
        mamaAtm: -15000,
        notes: 'Hiram ni Mhariz'
      }
    ]
  };

  // 5. Mama's Personal Savings Static Bundle Zero-Leak & Synthetic Calculation Test
  results.push(
    runSyncTest(
      'UT-05',
      'Unit Test',
      "Mama's Personal Savings",
      'MAMAS_SAVINGS_DATA in public client bundle has 0 leaked records (₱0.00) while calculateMamasTotals accurately reconciles deposits, withdrawals, and loans',
      () => {
        const bundleCheck =
          MAMAS_SAVINGS_DATA.records.length === 0 &&
          MAMAS_SAVINGS_DATA.investBalance === 0 &&
          MAMAS_SAVINGS_DATA.mamaAtmBalance === 0 &&
          MAMAS_SAVINGS_DATA.loanToMhariz === 0 &&
          MAMAS_SAVINGS_DATA.totalSavings === 0;
        const calc = calculateMamasTotals(SYNTHETIC_MAMAS_FIXTURE);
        const passed =
          bundleCheck &&
          calc.investBalance === 10000 &&
          calc.mamaAtmBalance === 20000 &&
          calc.loanToMhariz === 15000 &&
          calc.totalSavings === 45000;
        return {
          passed,
          expected: 'Bundle: 0 records (₱0.00) | Synthetic Fixture: BPI ST ₱10,000 | ATM ₱20,000 | Loan ₱15,000 | Total ₱45,000',
          actual: `Bundle: ${MAMAS_SAVINGS_DATA.records.length} records (${formatPHP(MAMAS_SAVINGS_DATA.totalSavings)}) | Fixture: BPI ST ${formatPHP(calc.investBalance)} | ATM ${formatPHP(calc.mamaAtmBalance)} | Loan ${formatPHP(calc.loanToMhariz)} | Total ${formatPHP(calc.totalSavings)}`
        };
      }
    )
  );

  // 6. Mama's Savings Loan Repayment Edit & Delete Consistency (Regression Test for Loan Drift Fix)
  results.push(
    runSyncTest(
      'UT-06',
      'Unit Test',
      "Mama's Personal Savings",
      'calculateMamasTotals dynamically derives loan receivable on add, edit, and delete of repayments (even with renamed loan bucket)',
      () => {
        const customLabels = {
          investLabel: 'BPI Short Term',
          atmLabel: 'Mama ATM',
          loanLabel: 'Family Receivable'
        };
        const stateWithRepayment: MamasSavingsState = {
          ...SYNTHETIC_MAMAS_FIXTURE,
          bucketLabels: customLabels,
          records: [
            ...SYNTHETIC_MAMAS_FIXTURE.records,
            {
              id: 'repay-test',
              rowRef: 4,
              date: '2026-11-15',
              displayDate: 'Nov 15, 2026',
              invest: 0,
              mamaAtm: 5000,
              notes: 'Partial repayment for Family Receivable'
            }
          ]
        };
        const afterAdd = calculateMamasTotals(stateWithRepayment);

        // Now simulate editing repayment from 5,000 to 9,000
        const afterEdit = calculateMamasTotals({
          ...stateWithRepayment,
          records: stateWithRepayment.records.map((r) =>
            r.id === 'repay-test' ? { ...r, mamaAtm: 9000 } : r
          )
        });

        // Now simulate deleting the repayment record
        const afterDelete = calculateMamasTotals({
          ...stateWithRepayment,
          records: SYNTHETIC_MAMAS_FIXTURE.records
        });

        const passed =
          afterAdd.loanToMhariz === 10000 &&
          afterAdd.mamaAtmBalance === 25000 &&
          afterAdd.totalSavings === 45000 &&
          afterEdit.loanToMhariz === 6000 &&
          afterEdit.mamaAtmBalance === 29000 &&
          afterEdit.totalSavings === 45000 &&
          afterDelete.loanToMhariz === 15000 &&
          afterDelete.mamaAtmBalance === 20000 &&
          afterDelete.totalSavings === 45000;

        return {
          passed,
          expected: 'After +5k repay: Loan ₱10k | After edit +9k: Loan ₱6k | After delete: Loan ₱15k (Total always ₱45,000)',
          actual: `After +5k: Loan ${formatPHP(afterAdd.loanToMhariz)} | After edit +9k: Loan ${formatPHP(afterEdit.loanToMhariz)} | After delete: Loan ${formatPHP(afterDelete.loanToMhariz)} (Total ${formatPHP(afterDelete.totalSavings)})`
        };
      }
    )
  );

  // 7. Mama's Savings Custom Account Buckets Calculation & Normalization
  results.push(
    runSyncTest(
      'UT-07',
      'Unit Test',
      "Mama's Personal Savings",
      'Custom account buckets normalize IDs/categories and add accurately into totalSavings',
      () => {
        const rawBuckets = [
          { id: 'mp2 fund!', label: 'Pag-IBIG MP2', category: 'investment', description: '5-yr dividend' },
          { id: 'mp2 fund!', label: 'Duplicate ID ignored', category: 'liquid_cash' },
          { id: '', label: 'GCash Wallet', category: 'invalid_cat' as any }
        ];
        const normalized = normalizeMamasCustomBuckets(rawBuckets);
        const stateWithCustom: MamasSavingsState = {
          ...SYNTHETIC_MAMAS_FIXTURE,
          customBuckets: normalized,
          records: [
            ...SYNTHETIC_MAMAS_FIXTURE.records,
            {
              id: 'cust-1',
              rowRef: 4,
              date: '2026-11-18',
              displayDate: 'Nov 18, 2026',
              invest: 0,
              mamaAtm: 0,
              customBucketId: normalized[0]?.id,
              customAmount: 12000,
              notes: 'MP2 deposit'
            }
          ]
        };
        const calc = calculateMamasTotals(stateWithCustom);
        const passed =
          normalized.length === 2 &&
          normalized[0].id === 'mp2_fund_' &&
          normalized[1].category === 'investment' &&
          calc.totalSavings === 57000;
        return {
          passed,
          expected: '2 normalized buckets | Custom +₱12,000 -> Total Savings ₱57,000.00',
          actual: `${normalized.length} normalized buckets | Total Savings ${formatPHP(calc.totalSavings)}`
        };
      }
    )
  );

  // 8. Legacy Label Migration ("Invest Fund Reserve" -> "BPI Short Term")
  results.push(
    runSyncTest(
      'UT-08',
      'Unit Test',
      'Reference Data & Migration',
      'normalizeMamasBucketLabels automatically upgrades legacy "Invest Fund" / "Invest Fund Reserve" to "BPI Short Term" while preserving custom renames',
      () => {
        const fromLegacy1 = normalizeMamasBucketLabels({
          investLabel: 'Invest Fund Reserve',
          atmLabel: 'Mama ATM',
          loanLabel: 'Hiram ni Mhariz'
        });
        const fromLegacy2 = normalizeMamasBucketLabels({
          investLabel: 'Invest Fund',
          atmLabel: '',
          loanLabel: ''
        });
        const fromCustom = normalizeMamasBucketLabels({
          investLabel: 'BPI Short Term UITF',
          atmLabel: 'BDO Passbook',
          loanLabel: 'Hiram ni Mhariz'
        });
        const passed =
          fromLegacy1.investLabel === 'BPI Short Term' &&
          fromLegacy2.investLabel === 'BPI Short Term' &&
          fromLegacy2.atmLabel === 'Mama ATM' &&
          fromCustom.investLabel === 'BPI Short Term UITF' &&
          fromCustom.atmLabel === 'BDO Passbook';
        return {
          passed,
          expected: 'Legacy -> "BPI Short Term" | Custom -> "BPI Short Term UITF"',
          actual: `Legacy -> "${fromLegacy1.investLabel}" | Custom -> "${fromCustom.investLabel}"`
        };
      }
    )
  );

  // 9. Excel Serial Date & ISO Date Formatter
  results.push(
    runSyncTest(
      'UT-09',
      'Unit Test',
      'Date & Note Normalization',
      'formatIsoOrSerialDate converts both ISO YYYY-MM-DD and Excel 5-digit serial dates (e.g. 46200) to human-readable dates',
      () => {
        const fromIso = formatIsoOrSerialDate('2026-04-27', '46139');
        const fromSerialOnly = formatIsoOrSerialDate(undefined, '45838'); // 2025-06-30
        const defaultNote = defaultMamasRecordNote(
          5000,
          0,
          'Monthly allocation to Invest Fund Reserve',
          '2025-06-30',
          DEFAULT_MAMAS_BUCKET_LABELS
        );
        const passed =
          fromIso === 'Apr 27, 2026' &&
          fromSerialOnly.includes('2025') &&
          defaultNote === 'Monthly allocation to BPI Short Term';
        return {
          passed,
          expected: 'Apr 27, 2026 | 2025 date | "Monthly allocation to BPI Short Term"',
          actual: `${fromIso} | ${fromSerialOnly} | "${defaultNote}"`
        };
      }
    )
  );

  // 10. RBAC Admin Authorization Guard (`isLedgerAdmin`)
  results.push(
    runSyncTest(
      'UT-10',
      'Unit Test',
      'Security & Access Control',
      'isLedgerAdmin strictly requires verified jrjacob2000@gmail.com and rejects unverified, null, or other accounts',
      () => {
        const validAdmin = isLedgerAdmin({
          email: 'jrjacob2000@gmail.com',
          emailVerified: true
        } as any);
        const validAdminCaseInsensitive = isLedgerAdmin({
          email: 'JRJACOB2000@GMAIL.COM',
          emailVerified: true
        } as any);
        const unverifiedAdmin = isLedgerAdmin({
          email: 'jrjacob2000@gmail.com',
          emailVerified: false
        } as any);
        const otherVerifiedUser = isLedgerAdmin({
          email: 'other.member@gmail.com',
          emailVerified: true
        } as any);
        const nullUser = isLedgerAdmin(null);

        const passed =
          validAdmin === true &&
          validAdminCaseInsensitive === true &&
          unverifiedAdmin === false &&
          otherVerifiedUser === false &&
          nullUser === false;
        return {
          passed,
          expected: 'Verified Admin: true | Unverified: false | Other Email: false | Null: false',
          actual: `Verified Admin: ${validAdmin} | Unverified: ${unverifiedAdmin} | Other Email: ${otherVerifiedUser} | Null: ${nullUser}`
        };
      }
    )
  );

  // 11. Firestore Schema Rule Bounds & Sanitization (`sanitizeDocId`, `clampNumber`, `buildTransactionCreatePayload`)
  results.push(
    runSyncTest(
      'UT-11',
      'Unit Test',
      'Security & Schema Validation',
      'Payload builders clamp monetary numbers [-100M, 100M], sanitize doc IDs, and enforce valid categories matching firestore.rules',
      () => {
        const cleanId = sanitizeDocId('row/123..$#test');
        const clampedHigh = clampNumber(999999999, -100000000, 100000000);
        const clampedNaN = clampNumber(Number.NaN, -100000000, 100000000);
        const membersFallback = sanitizeMembersList(['   ', '']);
        const createPayload = buildTransactionCreatePayload(
          'admin-uid-123',
          {
            date: '2026-10-26',
            displayDate: '10/26/26',
            description: 'Test Deposit',
            category: 'InvalidCategory' as any,
            memberOrBeneficiary: 'Jonathan',
            amountOnHand: 1500.556,
            bpiMoneyMarket: 0,
            bpiShortTerm: 0,
            memberLoan: 0
          },
          112
        );
        const updatePayload = buildTransactionUpdatePayload(
          {
            date: '2026-10-26',
            displayDate: '10/26/26',
            description: 'Updated Deposit',
            category: 'Contribution',
            memberOrBeneficiary: 'Jonathan',
            amountOnHand: 2000,
            bpiMoneyMarket: 0,
            bpiShortTerm: 0,
            memberLoan: 0
          },
          112
        );

        const passed =
          cleanId === 'row-123----test' &&
          clampedHigh === 100000000 &&
          clampedNaN === 0 &&
          membersFallback.length === 4 &&
          createPayload.category === 'Contribution' &&
          createPayload.amountOnHand === 1500.56 &&
          createPayload.ownerId === 'admin-uid-123' &&
          !('ownerId' in updatePayload) &&
          !('ledgerId' in updatePayload);

        return {
          passed,
          expected: 'Sanitized ID, clamped numbers, valid category fallback, immutable fields omitted on update',
          actual: `ID: ${cleanId} | Clamped: ${clampedHigh} | Cat: ${createPayload.category} | Amt: ${createPayload.amountOnHand}`
        };
      }
    )
  );

  // 12. Google Drive & Google Sheets 2-Tab Backup Matrix Builder (`buildSpreadsheetValueRanges`)
  results.push(
    runSyncTest(
      'UT-12',
      'Unit Test',
      'Google Drive & Sheets Backup',
      'buildSpreadsheetValueRanges builds 2-tab value matrices ("E-Fund" + "Mamas savings") with dynamic bucket headers and summary totals',
      () => {
        const { efundValues, mamasValues } = buildSpreadsheetValueRanges(
          INITIAL_EFUND_DB,
          SYNTHETIC_MAMAS_FIXTURE
        );
        // efundValues = 1 header + 107 data rows + 1 blank row + 1 summary row = 110 rows
        // mamasValues = 1 header + 3 synthetic data rows + 1 blank row + 1 summary row = 6 rows
        const efundSummary = efundValues[efundValues.length - 1];
        const mamasSummary = mamasValues[mamasValues.length - 1];
        const mamasHeader = mamasValues[0];
        const passed =
          efundValues.length === 110 &&
          mamasValues.length === 6 &&
          efundSummary[3] === 'ACCOUNT TOTALS' &&
          efundSummary[6] === 11970 &&
          efundSummary[7] === 78000 &&
          efundSummary[8] === 6800 &&
          mamasHeader[3] === 'BPI Short Term (PHP)' &&
          mamasSummary[3] === 10000 &&
          mamasSummary[4] === 20000 &&
          mamasSummary[6] === 15000;

        return {
          passed,
          expected: 'E-Fund: 110 rows (Total ₱96,770) | Mamas Fixture: 6 rows ("BPI Short Term (PHP)", Total ₱45,000)',
          actual: `E-Fund: ${efundValues.length} rows | Mamas: ${mamasValues.length} rows (Col D: "${mamasHeader[3]}")`
        };
      }
    )
  );

  // 13. CSV Formula Injection Defense & External Google Drive URL Validation
  results.push(
    runSyncTest(
      'UT-13',
      'Unit Test',
      'Security & Input Sanitization',
      'sanitizeCsvCell neutralizes leading formula characters and safeGoogleDriveUrl restricts links to trusted HTTPS Google Drive/Docs origins',
      () => {
        const formulaEq = sanitizeCsvCell('=IMPORTXML("http://evil.example","//a")');
        const formulaPlus = sanitizeCsvCell('+SUM(A1:A2)');
        const formulaMinus = sanitizeCsvCell('-1+1');
        const formulaAt = sanitizeCsvCell('@cmd');
        const quotedNormal = sanitizeCsvCell('Check #104 "Mama"');

        const validDrive = safeGoogleDriveUrl('https://drive.google.com/file/d/abc123/view');
        const validDocs = safeGoogleDriveUrl('https://docs.google.com/spreadsheets/d/xyz/edit');
        const blockedJs = safeGoogleDriveUrl('javascript:alert(1)');
        const blockedEvil = safeGoogleDriveUrl('https://evil.example/phish');

        const passed =
          formulaEq.startsWith('"\'=') &&
          formulaPlus.startsWith('"\'+') &&
          formulaMinus.startsWith('"\'-') &&
          formulaAt.startsWith('"\'@') &&
          quotedNormal === '"Check #104 ""Mama"""' &&
          validDrive === 'https://drive.google.com/file/d/abc123/view' &&
          validDocs === 'https://docs.google.com/spreadsheets/d/xyz/edit' &&
          blockedJs === 'https://drive.google.com' &&
          blockedEvil === 'https://drive.google.com';

        return {
          passed,
          expected: 'Formulas prefixed with single quote | Trusted HTTPS Drive/Docs allowed | javascript:/untrusted blocked',
          actual: `Eq=${formulaEq.slice(0, 12)}... | JS->${blockedJs} | Evil->${blockedEvil}`
        };
      }
    )
  );

  return results;
}

/**
 * Runs live asynchronous Probe Tests against the active runtime environment,
 * Firestore database, authentication state, and local storage isolation.
 */
export async function runAllProbeTests(
  liveDb: ClanEFundDatabase,
  liveMamasState: MamasSavingsState
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  // PROBE 1: Environment & Dual-Firebase Routing Probe
  results.push(
    await runAsyncTest(
      'PT-01',
      'Probe Test',
      'Environment & Routing',
      'Dual-Firebase Environment Probe (AI Studio Dev vs Production clan-e-fund-ledger)',
      async () => {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'server';
        const isDevHost =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.run.app');
        const expectedEnv = isDevHost ? 'aistudio-dev' : 'production';
        const prodConfigured =
          PRODUCTION_FIREBASE_CONFIG.projectId === 'clan-e-fund-ledger' &&
          Boolean(PRODUCTION_FIREBASE_CONFIG.apiKey) &&
          Boolean(PRODUCTION_FIREBASE_CONFIG.firestoreDatabaseId);

        const passed =
          ACTIVE_FIREBASE_ENV === expectedEnv &&
          Boolean(FIREBASE_PROJECT_ID) &&
          Boolean(FIRESTORE_DATABASE_ID) &&
          prodConfigured;

        return {
          passed,
          expected: `Env: ${expectedEnv} | Prod fallback: clan-e-fund-ledger ready`,
          actual: `Env: ${ACTIVE_FIREBASE_ENV} | Active Project: ${FIREBASE_PROJECT_ID} | Prod Project: ${PRODUCTION_FIREBASE_CONFIG.projectId}`,
          details: `Host: ${hostname} | DB ID: ${FIRESTORE_DATABASE_ID}`
        };
      }
    )
  );

  // PROBE 2: Live Firestore Shared Ledger Header Probe
  results.push(
    await runAsyncTest(
      'PT-02',
      'Probe Test',
      'Live Firestore Connectivity',
      `Read probe on /ledgers/${SHARED_LEDGER_ID} configuration document`,
      async () => {
        let targetId = SHARED_LEDGER_ID;
        let snap = await getDoc(doc(firestoreDb, 'ledgers', targetId));
        if (!snap.exists() && targetId !== 'clan-efund-main') {
          targetId = 'clan-efund-main';
          snap = await getDoc(doc(firestoreDb, 'ledgers', targetId));
        }
        if (!snap.exists()) {
          return {
            passed: false,
            expected: `/ledgers/${SHARED_LEDGER_ID} document exists in Firestore`,
            actual: 'Document does not exist yet'
          };
        }
        const data = snap.data();
        const hasRequiredFields =
          typeof data.clanName === 'string' &&
          data.currency === 'PHP' &&
          Array.isArray(data.members) &&
          data.members.length >= 1;

        return {
          passed: hasRequiredFields,
          expected: 'Document exists with clanName, currency="PHP", and members[]',
          actual: `Exists (/ledgers/${targetId}) | clanName="${data.clanName}" | currency="${data.currency}" | ${data.members?.length ?? 0} members`
        };
      }
    )
  );

  // PROBE 3: Live Firestore Transactions Subcollection Integrity Probe
  results.push(
    await runAsyncTest(
      'PT-03',
      'Probe Test',
      'Live Firestore Connectivity',
      `Query probe on /ledgers/${SHARED_LEDGER_ID}/transactions subcollection (> 25 rows & row-4 anchor present)`,
      async () => {
        let targetId = SHARED_LEDGER_ID;
        let qSnap = await getDocs(
          query(
            collection(firestoreDb, 'ledgers', targetId, 'transactions'),
            where('ledgerId', '==', targetId)
          )
        );
        if (qSnap.empty && targetId !== 'clan-efund-main') {
          targetId = 'clan-efund-main';
          qSnap = await getDocs(
            query(
              collection(firestoreDb, 'ledgers', targetId, 'transactions'),
              where('ledgerId', '==', targetId)
            )
          );
        }
        const count = qSnap.size;
        const hasRow4 = qSnap.docs.some((d) => d.id === 'row-4');
        const passed = count > 25 && hasRow4;
        return {
          passed,
          expected: '> 25 migrated documents & row-4 (2024-01-27) anchor present',
          actual: `${count} documents returned (/ledgers/${targetId}) | row-4 present: ${hasRow4}`
        };
      }
    )
  );

  // PROBE 4: Live In-Memory vs Calculated Accounting Reconciliation Probe
  results.push(
    await runAsyncTest(
      'PT-04',
      'Probe Test',
      'Data Integrity & Reconciliation',
      'Live Clan E-Fund state has valid dates, finite numbers, and 4-bucket sum equals Total Fund',
      async () => {
        const totals = calculateTotals(liveDb);
        const sumOfFour = Number(
          (
            totals.amountOnHand +
            totals.bpiMoneyMarket +
            totals.bpiShortTerm +
            totals.memberLoan
          ).toFixed(2)
        );
        const invalidRows = liveDb.transactions.filter(
          (t) =>
            !t.id ||
            !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
            !Number.isFinite(t.amountOnHand) ||
            !Number.isFinite(t.bpiMoneyMarket) ||
            !Number.isFinite(t.bpiShortTerm) ||
            !Number.isFinite(t.memberLoan ?? 0)
        );
        const passed = sumOfFour === totals.totalFund && invalidRows.length === 0;
        return {
          passed,
          expected: `4-bucket sum === ${formatPHP(totals.totalFund)} | 0 malformed rows`,
          actual: `4-bucket sum: ${formatPHP(sumOfFour)} | ${invalidRows.length} malformed rows across ${liveDb.transactions.length} entries`
        };
      }
    )
  );

  // PROBE 5: Private Vault RBAC & Security Probe (`/mamas_savings/state`)
  results.push(
    await runAsyncTest(
      'PT-05',
      'Probe Test',
      'Security & Privacy Isolation',
      `Live access probe on private /mamas_savings/${MAMAS_SAVINGS_DOC_ID} document`,
      async () => {
        const currentUser = auth.currentUser;
        const isAdmin = isLedgerAdmin(currentUser);
        const mamasRef = doc(firestoreDb, 'mamas_savings', MAMAS_SAVINGS_DOC_ID);

        if (isAdmin) {
          const snap = await getDoc(mamasRef);
          const exists = snap.exists();
          const data = snap.data();
          const labels = normalizeMamasBucketLabels(data?.bucketLabels);
          const passed = exists && Boolean(labels.investLabel);
          return {
            passed,
            expected: `Admin (${ADMIN_EMAIL}) granted read access to /mamas_savings/${MAMAS_SAVINGS_DOC_ID}`,
            actual: exists
              ? `Read succeeded | Invest Label: "${labels.investLabel}" | ${Array.isArray(data?.records) ? data.records.length : 0} records`
              : 'Document not yet created'
          };
        } else {
          // If not signed in as admin, Firestore rules MUST block reading /mamas_savings/state
          try {
            await getDoc(mamasRef);
            return {
              passed: false,
              expected: 'Permission denied for non-admin user',
              actual: 'Unexpected read success for non-admin user'
            };
          } catch {
            return {
              passed: true,
              expected: 'Firestore security rules block non-admin read',
              actual: 'Access denied by Firestore rules as expected'
            };
          }
        }
      }
    )
  );

  // PROBE 6: Client-Side Cache & Memory Isolation Probe
  results.push(
    await runAsyncTest(
      'PT-06',
      'Probe Test',
      'Security & Privacy Isolation',
      'LocalStorage and in-memory state isolation probe for Mama\'s Personal Savings',
      async () => {
        const currentUser = auth.currentUser;
        const isAdmin = isLedgerAdmin(currentUser);
        const cachedMamas =
          localStorage.getItem(MAMAS_SAVINGS_CACHE_KEY) ||
          localStorage.getItem('mamas_personal_savings_v2_cache');
        const leakedMamasKey = Object.keys(localStorage).find((k) =>
          /^mamas_(personal_)?savings/i.test(k)
        );

        if (isAdmin) {
          const calc = calculateMamasTotals(liveMamasState);
          const passed =
            calc.totalSavings === liveMamasState.totalSavings &&
            Array.isArray(liveMamasState.records);
          return {
            passed,
            expected: 'Admin session holds reconciled Mama\'s Savings state',
            actual: `Admin verified | ${liveMamasState.records.length} records | Total: ${formatPHP(liveMamasState.totalSavings)}`
          };
        } else {
          const passed =
            cachedMamas === null &&
            !leakedMamasKey &&
            liveMamasState.records.length === 0 &&
            liveMamasState.totalSavings === 0;
          return {
            passed,
            expected: 'Non-admin session has 0 records in memory and null localStorage cache',
            actual: `Cache: ${leakedMamasKey ? leakedMamasKey : 'null'} | Memory records: ${liveMamasState.records.length}`
          };
        }
      }
    )
  );

  // PROBE 7: Google Drive & Sheets OAuth Scope Minimization & In-Memory Token Security Probe
  results.push(
    await runAsyncTest(
      'PT-07',
      'Probe Test',
      'Google Drive & Workspace Security',
      'Least-privilege OAuth scopes (drive.file + spreadsheets) and zero localStorage/sessionStorage token persistence probe',
      async () => {
        const hasDriveFile = WORKSPACE_SCOPES.includes(
          'https://www.googleapis.com/auth/drive.file'
        );
        const hasSpreadsheets = WORKSPACE_SCOPES.includes(
          'https://www.googleapis.com/auth/spreadsheets'
        );
        const hasOverbroadDrive = WORKSPACE_SCOPES.includes(
          'https://www.googleapis.com/auth/drive'
        );

        // Ensure no OAuth access token is ever leaked into localStorage or sessionStorage
        const storageKeys = [
          ...Object.keys(localStorage),
          ...(typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage) : [])
        ];
        const leakedTokenKey = storageKeys.find((k) =>
          /access_token|oauth_token|drive_token/i.test(k)
        );

        const passed =
          hasDriveFile &&
          hasSpreadsheets &&
          !hasOverbroadDrive &&
          !leakedTokenKey;

        return {
          passed,
          expected: 'Scopes: [drive.file, spreadsheets] | No broad drive scope | 0 persisted OAuth tokens in Web Storage',
          actual: `Scopes: ${WORKSPACE_SCOPES.length} (${hasDriveFile && hasSpreadsheets ? 'drive.file + spreadsheets' : 'missing'}) | Storage leak: ${leakedTokenKey || 'none'}`
        };
      }
    )
  );

  return results;
}
