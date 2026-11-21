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
    throw new Error(
      `Google Drive API error (${res.status}): ${errBody.slice(0, 200)}`
    );
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
    throw new Error(
      `Failed to create Google Sheet (${createRes.status}): ${errText.slice(0, 200)}`
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate values into both sheets via values:batchUpdate
  const { efundValues, mamasValues } = buildSpreadsheetValueRanges(db, mamasState);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
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
      `Created sheet but failed to populate rows (${updateRes.status}): ${errText.slice(0, 200)}`
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
  // 1. Fetch spreadsheet metadata first to verify existing sheet tab names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(
      `Failed to inspect target Google Sheet (${metaRes.status}): ${errText.slice(0, 200)}`
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
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
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
  }

  // Clear existing ranges first so old trailing rows don't remain
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ranges: [`'${escapedFirstTabTitle}'!A1:Z1000`, `'Mamas savings'!A1:Z1000`]
      })
    }
  );

  // Write fresh values
  const { efundValues, mamasValues } = buildSpreadsheetValueRanges(db, mamasState);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
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
      `Failed to update Google Sheet backup (${updateRes.status}): ${errText.slice(0, 200)}`
    );
  }

  return {
    spreadsheetId,
    spreadsheetUrl:
      meta.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
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
      `Failed to upload JSON backup to Google Drive (${res.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = await res.json();
  return {
    fileId: data.id,
    fileName: data.name || fileName,
    webViewLink:
      data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  };
}
