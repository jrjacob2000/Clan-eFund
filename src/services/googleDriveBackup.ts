import {
  ClanEFundDatabase,
  MamasSavingsState,
  calculateTotals,
  calculateMamasTotals
} from '../data/initialLedger';
import {
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets
} from './firebaseDb';

export interface DriveBackupFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

const TRUSTED_GOOGLE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

/**
 * Validates that an external link returned by Google APIs uses `https:` and points
 * to a trusted Google Drive / Google Docs hostname before rendering in `<a href>`.
 */
export function safeGoogleDriveUrl(
  rawUrl: string | undefined,
  fallbackUrl: string = 'https://drive.google.com'
): string {
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && TRUSTED_GOOGLE_HOSTS.has(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // Fall through to safe fallback
    }
  }
  return fallbackUrl;
}

/**
 * Formats Google Drive / Google Sheets API HTTP errors clearly without cutting off
 * activation links when an API is disabled in the Google Cloud project.
 */
export function formatGoogleApiError(
  actionLabel: string,
  status: number,
  rawBody: string
): string {
  try {
    const parsed = JSON.parse(rawBody);
    const message: string | undefined = parsed?.error?.message;
    if (message) {
      return `${actionLabel} (${status}): ${message}`;
    }
  } catch {
    // Fallback to raw text if not JSON
  }
  return `${actionLabel} (${status}): ${rawBody.slice(0, 600)}`;
}

/**
 * Lists previous Clan E-Fund & Mama's Savings backups created by this app in the user's Google Drive.
 * Uses the `drive.file` scope (returns only files created/opened by this app).
 */
export async function listGoogleDriveBackups(
  accessToken: string
): Promise<DriveBackupFileItem[]> {
  const params = new URLSearchParams({
    q: 'trashed = false',
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '20'
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(formatGoogleApiError('Google Drive API error', res.status, errBody));
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Builds the 2-sheet row matrices for exporting both:
 * 1. Sheet 1 ("E-Fund"): All Clan Emergency Fund transactions + summary totals
 * 2. Sheet 2 ("Mamas savings"): All Mama's Personal Savings records + configured bucket totals
 */
export function buildSpreadsheetValueRanges(
  db: ClanEFundDatabase,
  mamasState: MamasSavingsState
) {
  const efundTotals = calculateTotals(db);
  const mamasCalc = calculateMamasTotals(mamasState);
  const labels = normalizeMamasBucketLabels(mamasState.bucketLabels);
  const customBuckets = normalizeMamasCustomBuckets(mamasState.customBuckets);

  // Sheet 1: E-Fund rows
  const efundHeader = [
    'Row Ref',
    'Date',
    'Display Date',
    'Description',
    'Category',
    'Member / Beneficiary',
    'Cash on Hand (PHP)',
    'BPI Money Market Fund (PHP)',
    'BPI Short Term (PHP)',
    'Member Loans Receivable (PHP)',
    'Notes'
  ];

  const efundDataRows = db.transactions.map((t, idx) => [
    t.rowRef ?? idx + 4,
    t.date,
    t.displayDate,
    t.description,
    t.category,
    t.memberOrBeneficiary,
    t.amountOnHand,
    t.bpiMoneyMarket,
    t.bpiShortTerm,
    t.memberLoan || 0,
    t.notes || ''
  ]);

  const efundSummaryRows = [
    [],
    [
      '',
      '',
      '',
      'ACCOUNT TOTALS',
      '',
      '',
      efundTotals.amountOnHand,
      efundTotals.bpiMoneyMarket,
      efundTotals.bpiShortTerm,
      efundTotals.memberLoan,
      `Total Clan E-Fund: ₱${efundTotals.totalFund.toFixed(2)}`
    ]
  ];

  // Sheet 2: Mamas savings rows
  const mamasHeader = [
    'Row Ref',
    'Date',
    'Display Date',
    `${labels.investLabel} (PHP)`,
    `${labels.atmLabel} (PHP)`,
    'Custom Bucket',
    'Custom Bucket Amount (PHP)',
    'Notes'
  ];

  const mamasDataRows = mamasCalc.records.map((r, idx) => {
    const customBucketLabel = r.customBucketId
      ? customBuckets.find((b) => b.id === r.customBucketId)?.label || r.customBucketId
      : '';
    return [
      r.rowRef ?? idx + 3,
      r.date,
      r.displayDate,
      r.invest,
      r.mamaAtm,
      customBucketLabel,
      r.customBucketId ? r.customAmount || 0 : '',
      r.notes || ''
    ];
  });

  const mamasSummaryRows = [
    [],
    [
      '',
      '',
      'SUMMARY BALANCES',
      mamasCalc.investBalance,
      mamasCalc.mamaAtmBalance,
      labels.loanLabel,
      mamasCalc.loanToMhariz,
      `Total Mama's Savings: ₱${mamasCalc.totalSavings.toFixed(2)}`
    ]
  ];

  return {
    efundValues: [efundHeader, ...efundDataRows, ...efundSummaryRows],
    mamasValues: [mamasHeader, ...mamasDataRows, ...mamasSummaryRows]
  };
}

/**
 * Creates a brand-new Google Spreadsheet in the user's Google Drive containing:
 * - Sheet 1 ("E-Fund"): Complete 4-bucket Clan Emergency Fund ledger
 * - Sheet 2 ("Mamas savings"): Complete Mama's Personal Savings ledger
 */
export async function createGoogleSheetsBackupInDrive(
  accessToken: string,
  db: ClanEFundDatabase,
  mamasState: MamasSavingsState
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const title = `Clan E-Fund & Mama's Savings Backup (${dateStamp})`;

  // 1. Create the spreadsheet container with 2 sheets
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'E-Fund',
            gridProperties: { frozenRowCount: 1 }
          }
        },
        {
          properties: {
            title: 'Mamas savings',
            gridProperties: { frozenRowCount: 1 }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(formatGoogleApiError('Failed to create Google Sheet', createRes.status, errText));
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const encodedSheetId = encodeURIComponent(spreadsheetId);
  const spreadsheetUrl: string = safeGoogleDriveUrl(
    created.spreadsheetUrl,
    `https://docs.google.com/spreadsheets/d/${encodedSheetId}/edit`
  );

  // 2. Populate values into both sheets via values:batchUpdate
  const { efundValues, mamasValues } = buildSpreadsheetValueRanges(db, mamasState);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          {
            range: `'E-Fund'!A1`,
            values: efundValues
          },
          {
            range: `'Mamas savings'!A1`,
            values: mamasValues
          }
        ]
      })
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      formatGoogleApiError('Created sheet but failed to populate rows', updateRes.status, errText)
    );
  }

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Overwrites an existing Google Spreadsheet backup in the user's Google Drive
 * with the latest Clan E-Fund and Mama's Savings data.
 * (Must only be called after explicit user confirmation in the UI!)
 */
export async function overwriteExistingGoogleSheetBackup(
  accessToken: string,
  spreadsheetId: string,
  db: ClanEFundDatabase,
  mamasState: MamasSavingsState
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const encodedSheetId = encodeURIComponent(spreadsheetId);

  // 1. Fetch spreadsheet metadata first to verify existing sheet tab names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(
      formatGoogleApiError('Failed to inspect target Google Sheet', metaRes.status, errText)
    );
  }

  const meta = await metaRes.json();
  const existingTitles: string[] = Array.isArray(meta.sheets)
    ? meta.sheets.map((s: any) => s?.properties?.title).filter(Boolean)
    : [];

  const firstTabTitle = existingTitles.includes('E-Fund')
    ? 'E-Fund'
    : existingTitles[0] || 'Sheet1';
  const escapedFirstTabTitle = firstTabTitle.replace(/'/g, "''");
  const hasMamasTab = existingTitles.includes('Mamas savings');

  // If 'Mamas savings' tab does not exist yet on this spreadsheet, add it
  if (!hasMamasTab) {
    const addTabRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Mamas savings',
                  gridProperties: { frozenRowCount: 1 }
                }
              }
            }
          ]
        })
      }
    );
    if (!addTabRes.ok) {
      const errText = await addTabRes.text();
      throw new Error(
        formatGoogleApiError('Failed to add Mamas savings tab', addTabRes.status, errText)
      );
    }
  }

  // Clear entire A:Z ranges first so old trailing rows don't remain even beyond 1,000 rows
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ranges: [`'${escapedFirstTabTitle}'!A:Z`, `'Mamas savings'!A:Z`]
      })
    }
  );
  if (!clearRes.ok) {
    const errText = await clearRes.text();
    throw new Error(
      formatGoogleApiError('Failed to clear existing Google Sheet ranges', clearRes.status, errText)
    );
  }

  // Write fresh values
  const { efundValues, mamasValues } = buildSpreadsheetValueRanges(db, mamasState);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          {
            range: `'${escapedFirstTabTitle}'!A1`,
            values: efundValues
          },
          {
            range: `'Mamas savings'!A1`,
            values: mamasValues
          }
        ]
      })
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      formatGoogleApiError('Failed to update Google Sheet backup', updateRes.status, errText)
    );
  }

  return {
    spreadsheetId,
    spreadsheetUrl: safeGoogleDriveUrl(
      meta.spreadsheetUrl,
      `https://docs.google.com/spreadsheets/d/${encodedSheetId}/edit`
    )
  };
}

/**
 * Uploads a full JSON snapshot (`clan-efund-backup-YYYY-MM-DD.json`) to the user's Google Drive
 * using multipart upload (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`).
 */
export async function uploadJsonBackupToGoogleDrive(
  accessToken: string,
  db: ClanEFundDatabase,
  mamasState: MamasSavingsState
): Promise<{ fileId: string; fileName: string; webViewLink: string }> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `clan-efund-full-backup-${dateStamp}.json`;

  const payload = {
    backedUpAt: new Date().toISOString(),
    clanEFundLedger: db,
    mamasPersonalSavings: mamasState
  };

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description:
      "Full JSON backup of Clan Emergency Fund (E-Fund) and Mama's Personal Savings from Firestore"
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(payload, null, 2) +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      formatGoogleApiError('Failed to upload JSON backup to Google Drive', res.status, errText)
    );
  }

  const data = await res.json();
  const encodedFileId = encodeURIComponent(String(data.id || ''));
  return {
    fileId: data.id,
    fileName: data.name || fileName,
    webViewLink: safeGoogleDriveUrl(
      data.webViewLink,
      `https://drive.google.com/file/d/${encodedFileId}/view`
    )
  };
}
