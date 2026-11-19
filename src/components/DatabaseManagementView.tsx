import React, { useState, useMemo } from 'react';
import {
  Database,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Search,
  Copy,
  Check,
  Eye,
  Layers,
  Server,
  HardDrive,
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  CloudUpload
} from 'lucide-react';
import {
  APP_VERSION,
  ClanEFundDatabase,
  MamasSavingsState,
  calculateTotals,
  formatPHP
} from '../data/initialLedger';
import {
  ACTIVE_FIREBASE_ENV,
  ACTIVE_FIREBASE_ENV_LABEL,
  ADMIN_EMAIL,
  EXPORT_JSON_FILENAME,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  MAMAS_SAVINGS_DOC_ID,
  SHARED_LEDGER_ID,
  authorizeGoogleDriveAccess,
  getAccessToken,
  normalizeMamasBucketLabels,
  normalizeMamasCustomBuckets
} from '../services/firebaseDb';
import {
  DriveBackupFileItem,
  createGoogleSheetsBackupInDrive,
  listGoogleDriveBackups,
  overwriteExistingGoogleSheetBackup,
  uploadJsonBackupToGoogleDrive
} from '../services/googleDriveBackup';
import {
  TestCaseResult,
  runAllProbeTests,
  runAllUnitTests
} from '../tests/diagnosticsSuite';
import { PaginationBar } from './PaginationBar';

interface DatabaseManagementViewProps {
  db: ClanEFundDatabase;
  mamasState: MamasSavingsState;
  canManage: boolean;
  userEmail?: string | null;
  isSyncing: boolean;
  onGoogleSignIn: () => void;
  onOpenResetConfirmModal: () => void;
  onDownloadJson: () => void;
  onDownloadCsv: () => void;
  onImportJsonFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReturnToDashboard: () => void;
}

type DbConsoleTab = 'overview' | 'explorer' | 'payload' | 'reference' | 'tests';

export const DatabaseManagementView: React.FC<DatabaseManagementViewProps> = ({
  db,
  mamasState,
  canManage,
  userEmail,
  isSyncing,
  onGoogleSignIn,
  onOpenResetConfirmModal,
  onDownloadJson,
  onDownloadCsv,
  onImportJsonFile,
  onReturnToDashboard
}) => {
  const [activeTab, setActiveTab] = useState<DbConsoleTab>('overview');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerCollection, setExplorerCollection] = useState<'efund' | 'mamas'>('efund');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [explorerPage, setExplorerPage] = useState<number>(1);
  const [explorerPageSize, setExplorerPageSize] = useState<number>(10);

  // Unit & Probe Test Runner State
  const [unitResults, setUnitResults] = useState<TestCaseResult[]>(() => runAllUnitTests());
  const [probeResults, setProbeResults] = useState<TestCaseResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [lastTestRunAt, setLastTestRunAt] = useState<string | null>(null);

  const handleRunDiagnostics = async () => {
    setIsRunningTests(true);
    try {
      const units = runAllUnitTests();
      setUnitResults(units);
      const probes = await runAllProbeTests(db, mamasState);
      setProbeResults(probes);
      setLastTestRunAt(new Date().toLocaleTimeString());
    } finally {
      setIsRunningTests(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'tests' && probeResults.length === 0 && !isRunningTests) {
      handleRunDiagnostics();
    }
  }, [activeTab]);

  // Google Drive & Sheets Backup State
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFileItem[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<{
    label: string;
    url: string;
    timestamp: string;
  } | null>(null);
  const [overwriteConfirmTarget, setOverwriteConfirmTarget] =
    useState<DriveBackupFileItem | null>(null);

  const ensureDriveToken = async (): Promise<string | null> => {
    setDriveErrorMsg(null);
    let token = driveAccessToken || (await getAccessToken());
    if (!token) {
      try {
        token = await authorizeGoogleDriveAccess();
        setDriveAccessToken(token);
      } catch (err: any) {
        setDriveErrorMsg(
          err instanceof Error
            ? err.message
            : 'Google Drive authorization was cancelled or failed.'
        );
        return null;
      }
    }
    return token;
  };

  const handleRefreshDriveBackups = async (explicitToken?: string) => {
    const token = explicitToken || (await ensureDriveToken());
    if (!token) return;
    setIsDriveLoading(true);
    setDriveErrorMsg(null);
    try {
      const files = await listGoogleDriveBackups(token);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveErrorMsg(
        err instanceof Error ? err.message : 'Failed to list Google Drive backups.'
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

  React.useEffect(() => {
    getAccessToken().then((token) => {
      if (token) {
        setDriveAccessToken(token);
        listGoogleDriveBackups(token)
          .then((files) => setDriveFiles(files))
          .catch(() => {
            // Silent initial check
          });
      }
    });
  }, []);

  const handleBackupToNewGoogleSheet = async () => {
    const token = await ensureDriveToken();
    if (!token) return;
    setIsDriveLoading(true);
    setDriveErrorMsg(null);
    setDriveStatusMsg('Creating 2-tab Google Sheet backup in your Google Drive...');
    try {
      const res = await createGoogleSheetsBackupInDrive(token, db, mamasState);
      setLastBackupResult({
        label: res.title,
        url: res.spreadsheetUrl,
        timestamp: new Date().toLocaleTimeString()
      });
      setDriveStatusMsg(`Backed up to Google Sheets: "${res.title}"`);
      const files = await listGoogleDriveBackups(token);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveErrorMsg(
        err instanceof Error ? err.message : 'Failed to create Google Sheet backup.'
      );
      setDriveStatusMsg(null);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleBackupJsonToDrive = async () => {
    const token = await ensureDriveToken();
    if (!token) return;
    setIsDriveLoading(true);
    setDriveErrorMsg(null);
    setDriveStatusMsg('Uploading full JSON snapshot to your Google Drive...');
    try {
      const res = await uploadJsonBackupToGoogleDrive(token, db, mamasState);
      setLastBackupResult({
        label: res.fileName,
        url: res.webViewLink,
        timestamp: new Date().toLocaleTimeString()
      });
      setDriveStatusMsg(`Uploaded JSON backup to Google Drive: "${res.fileName}"`);
      const files = await listGoogleDriveBackups(token);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveErrorMsg(
        err instanceof Error ? err.message : 'Failed to upload JSON backup to Google Drive.'
      );
      setDriveStatusMsg(null);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleConfirmOverwriteExistingSheet = async () => {
    if (!overwriteConfirmTarget) return;
    const target = overwriteConfirmTarget;
    setOverwriteConfirmTarget(null);

    const token = await ensureDriveToken();
    if (!token) return;
    setIsDriveLoading(true);
    setDriveErrorMsg(null);
    setDriveStatusMsg(`Updating existing Google Sheet "${target.name}"...`);
    try {
      const res = await overwriteExistingGoogleSheetBackup(
        token,
        target.id,
        db,
        mamasState
      );
      setLastBackupResult({
        label: target.name,
        url: res.spreadsheetUrl,
        timestamp: new Date().toLocaleTimeString()
      });
      setDriveStatusMsg(`Updated existing Google Sheet backup: "${target.name}"`);
      const files = await listGoogleDriveBackups(token);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveErrorMsg(
        err instanceof Error ? err.message : 'Failed to overwrite existing Google Sheet.'
      );
      setDriveStatusMsg(null);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const efundTotals = useMemo(() => calculateTotals(db), [db]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filtered document list for the Explorer tab
  const filteredEfundDocs = useMemo(() => {
    if (!explorerSearch.trim()) return db.transactions;
    const q = explorerSearch.toLowerCase();
    return db.transactions.filter(
      (tx) =>
        tx.id.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.date.includes(q) ||
        tx.memberOrBeneficiary.toLowerCase().includes(q)
    );
  }, [db.transactions, explorerSearch]);

  const filteredMamasDocs = useMemo(() => {
    if (!explorerSearch.trim()) return mamasState.records;
    const q = explorerSearch.toLowerCase();
    return mamasState.records.filter(
      (r) =>
        (r.id || '').toLowerCase().includes(q) ||
        r.date.includes(q) ||
        r.displayDate.includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
    );
  }, [mamasState.records, explorerSearch]);

  React.useEffect(() => {
    setExplorerPage(1);
  }, [explorerSearch, explorerCollection]);

  const paginatedEfundDocs = useMemo(() => {
    if (explorerPageSize <= 0) return filteredEfundDocs;
    const totalPages = Math.max(1, Math.ceil(filteredEfundDocs.length / explorerPageSize));
    const safePage = Math.min(Math.max(1, explorerPage), totalPages);
    const start = (safePage - 1) * explorerPageSize;
    return filteredEfundDocs.slice(start, start + explorerPageSize);
  }, [filteredEfundDocs, explorerPage, explorerPageSize]);

  const paginatedMamasDocs = useMemo(() => {
    if (explorerPageSize <= 0) return filteredMamasDocs;
    const totalPages = Math.max(1, Math.ceil(filteredMamasDocs.length / explorerPageSize));
    const safePage = Math.min(Math.max(1, explorerPage), totalPages);
    const start = (safePage - 1) * explorerPageSize;
    return filteredMamasDocs.slice(start, start + explorerPageSize);
  }, [filteredMamasDocs, explorerPage, explorerPageSize]);

  const handleCopyDocJson = (id: string, obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedDocId(id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  const handleCopyFullPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(db, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Strictly restrict this view to jrjacob2000@gmail.com
  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-6 max-w-xl mx-auto shadow-xs my-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            Database Admin Console is Private
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Access to Firestore database management, raw JSON payloads, schema inspectors, and remigration controls is strictly restricted to Jonathan (<span className="font-mono font-semibold text-slate-800">{ADMIN_EMAIL}</span>).
          </p>
          {userEmail ? (
            <p className="text-xs text-red-700 bg-red-50 rounded-md py-1.5 px-3 font-mono inline-block">
              Signed in as: {userEmail} (Unauthorized)
            </p>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-100 rounded-md py-1.5 px-3 font-medium inline-block">
              You are currently browsing in View-Only Contributor Mode.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {!userEmail && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full sm:w-auto rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              Sign In as Manager
            </button>
          )}
          <button
            type="button"
            onClick={onReturnToDashboard}
            className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            ← Return to Clan E-Fund Dashboard
          </button>
        </div>
      </div>
    );
  }

  const payloadSize = JSON.stringify(db).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header: Project & Database Metadata */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Database className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Firestore Database Management Console
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  ACTIVE_FIREBASE_ENV === 'aistudio-dev'
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {ACTIVE_FIREBASE_ENV_LABEL}
              </span>
              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700">
                v{APP_VERSION} · Schema v{db.schemaVersion || 4}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Project ID: <strong className="text-slate-800">{FIREBASE_PROJECT_ID}</strong> · DB ID:{' '}
              <strong className="text-slate-800">{FIRESTORE_DATABASE_ID}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://console.firebase.google.com/u/0/project/${FIREBASE_PROJECT_ID}/firestore`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <span>Open Firebase Console</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Real-time Status Badges Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Realtime Listener</div>
              <div className="font-semibold text-slate-800 truncate">
                {isSyncing ? 'Syncing Changes...' : 'Live Connected'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Security Rules</div>
              <div className="font-semibold text-slate-800 truncate">RBAC Admin-Only</div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <Server className="h-4 w-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Documents Tracked</div>
              <div className="font-mono font-semibold text-slate-800 truncate">
                {db.transactions.length + mamasState.records.length} Total Rows
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <Lock className="h-4 w-4 text-purple-700 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Authorized Admin</div>
              <div className="font-mono font-semibold text-slate-800 truncate">{ADMIN_EMAIL}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Controls Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Overview &amp; Maintenance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('explorer')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'explorer'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Document Explorer</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
            {db.transactions.length + mamasState.records.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payload')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'payload'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <FileJson className="h-3.5 w-3.5" />
          <span>Raw JSON Snapshot</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
            {(payloadSize / 1024).toFixed(1)} KB
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reference')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'reference'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Master Reference Image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'tests'
              ? 'border-emerald-700 text-emerald-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          <span>Unit &amp; Probe Tests</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
            {unitResults.filter((r) => r.passed).length +
              probeResults.filter((r) => r.passed).length}
            /{unitResults.length + (probeResults.length || 6)}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & MAINTENANCE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Maintenance Actions Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-emerald-700" />
                <span>Database Sync &amp; Remigration Tools</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Execute master database operations, backup downloads, or re-seed from the master Excel file.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {/* Remigrate Master Spreadsheet Button */}
              <button
                type="button"
                onClick={onOpenResetConfirmModal}
                className="flex flex-col text-left p-4 rounded-lg border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/80 transition-all group"
              >
                <div className="flex items-center justify-between w-full text-emerald-950 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4 text-emerald-700 group-hover:rotate-180 transition-transform duration-500" />
                    <span>Reset &amp; Remigrate Spreadsheet</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
                </div>
                <p className="text-[11px] text-emerald-800/90 mt-2 leading-relaxed">
                  Overwrites Firestore with all 107 E-Fund records (₱96,770) and all 18 Mama&apos;s Savings records (₱63,200).
                </p>
              </button>

              {/* Download JSON Backup */}
              <button
                type="button"
                onClick={onDownloadJson}
                className="flex flex-col text-left p-4 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-all group"
              >
                <div className="flex items-center justify-between w-full text-slate-900 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-slate-600" />
                    <span>Export Full JSON Backup</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Download exact backup file (<span className="font-mono">{EXPORT_JSON_FILENAME}</span>) of all Firestore data.
                </p>
              </button>

              {/* Upload JSON Data */}
              <label className="flex flex-col text-left p-4 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-all cursor-pointer group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={onImportJsonFile}
                  className="hidden"
                />
                <div className="flex items-center justify-between w-full text-slate-900 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Upload className="h-4 w-4 text-slate-600" />
                    <span>Import JSON File</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Restore or seed Firestore database from a structured JSON backup file on your device.
                </p>
              </label>
            </div>
          </div>

          {/* Backup to Google Drive & Google Sheets Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3.5">
              <div className="flex items-start sm:items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white shrink-0">
                  <CloudUpload className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-emerald-950">
                      Backup to Google Drive &amp; Google Sheets
                    </h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        driveAccessToken
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {driveAccessToken ? 'Drive Connected' : 'Ready to Authorize'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Save a live 2-sheet Google Spreadsheet (<span className="font-mono font-semibold">E-Fund</span> +{' '}
                    <span className="font-mono font-semibold">Mamas savings</span>) or full JSON snapshot directly to your Google Drive.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleBackupToNewGoogleSheet}
                  disabled={isDriveLoading}
                  className="px-3.5 py-2 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 disabled:opacity-50 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>
                    {isDriveLoading ? 'Backing up...' : 'Backup to New Google Sheet'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleBackupJsonToDrive}
                  disabled={isDriveLoading}
                  className="px-3.5 py-2 rounded-lg border border-emerald-700 bg-white text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 transition-colors text-xs font-semibold flex items-center gap-1.5"
                >
                  <FileJson className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Backup JSON to Drive</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRefreshDriveBackups()}
                  disabled={isDriveLoading}
                  title="Refresh Google Drive backups list"
                  className="p-2 rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isDriveLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Status / Error Banner */}
            {driveErrorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{driveErrorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDriveErrorMsg(null)}
                  className="text-[11px] font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {driveStatusMsg && (
              <div className="rounded-lg border border-emerald-200 bg-white px-3.5 py-2.5 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{driveStatusMsg}</span>
                </div>
                {lastBackupResult && (
                  <a
                    href={lastBackupResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline shrink-0"
                  >
                    <span>Open in Google Drive</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* What Gets Backed Up Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3.5 border border-emerald-100 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Sheet 1: E-Fund (Emergency Fund)</span>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Shared Ledger
                  </span>
                </div>
                <div className="text-slate-600 text-xs">
                  Exports all <strong className="text-slate-900">{db.transactions.length}</strong> live transactions from{' '}
                  <span className="font-mono text-slate-800">/ledgers/{SHARED_LEDGER_ID}/transactions</span> across all 4 account buckets.
                </div>
                <div className="font-mono text-emerald-800 font-bold text-xs pt-1">
                  {formatPHP(efundTotals.totalFund)} Total Net Balance
                </div>
              </div>

              <div className="bg-white rounded-lg p-3.5 border border-purple-100 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Sheet 2: Mamas savings</span>
                  <span className="text-[10px] font-semibold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    <span>Private Account</span>
                  </span>
                </div>
                <div className="text-slate-600 text-xs">
                  Exports all <strong className="text-slate-900">{mamasState.records.length}</strong> records &amp; custom bucket balances from{' '}
                  <span className="font-mono text-slate-800">
                    /mamas_savings/{MAMAS_SAVINGS_DOC_ID}
                  </span>
                  .
                </div>
                <div className="font-mono text-purple-900 font-bold text-xs pt-1">
                  {formatPHP(mamasState.totalSavings)} Cumulative Savings Balance
                </div>
              </div>
            </div>

            {/* Recent App-Created Google Drive Backups List */}
            {driveFiles.length > 0 && (
              <div className="bg-white rounded-lg border border-emerald-100 overflow-hidden">
                <div className="px-3.5 py-2 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between text-[11px] font-semibold text-emerald-950">
                  <span>Recent Backups in Your Google Drive ({driveFiles.length})</span>
                  <span className="text-emerald-700 font-normal">
                    Click &ldquo;Update Sheet&rdquo; to sync latest rows into an existing sheet
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {driveFiles.slice(0, 6).map((file) => {
                    const isSheet =
                      file.mimeType === 'application/vnd.google-apps.spreadsheet';
                    const formattedDate = file.modifiedTime
                      ? new Date(file.modifiedTime).toLocaleString()
                      : '';
                    const fileUrl =
                      file.webViewLink ||
                      (isSheet
                        ? `https://docs.google.com/spreadsheets/d/${file.id}/edit`
                        : `https://drive.google.com/file/d/${file.id}/view`);
                    return (
                      <div
                        key={file.id}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSheet ? (
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                          ) : (
                            <FileJson className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 truncate">
                            {file.name}
                          </span>
                          {formattedDate && (
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              · {formattedDate}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSheet && (
                            <button
                              type="button"
                              onClick={() => setOverwriteConfirmTarget(file)}
                              disabled={isDriveLoading}
                              className="px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-semibold text-[11px]"
                            >
                              Update Sheet
                            </button>
                          )}
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Explicit Confirmation Modal for Overwriting an Existing Google Sheet Backup */}
          {overwriteConfirmTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">
                      Overwrite Existing Google Sheet Backup?
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      This will overwrite the contents of{' '}
                      <strong className="text-slate-900">
                        &ldquo;{overwriteConfirmTarget.name}&rdquo;
                      </strong>{' '}
                      in your Google Drive with the current{' '}
                      <strong>{db.transactions.length} Clan E-Fund rows</strong> ({formatPHP(efundTotals.totalFund)}) and{' '}
                      <strong>{mamasState.records.length} Mama&apos;s Savings rows</strong> ({formatPHP(mamasState.totalSavings)}).
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOverwriteConfirmTarget(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOverwriteExistingSheet}
                    className="px-4 py-2 rounded-lg bg-emerald-800 text-xs font-semibold text-white hover:bg-emerald-900 shadow-xs"
                  >
                    Confirm &amp; Overwrite Sheet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOCUMENT EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Collection Switcher */}
              <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setExplorerCollection('efund');
                    setExpandedDocId(null);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    explorerCollection === 'efund'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Clan E-Fund ({db.transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExplorerCollection('mamas');
                    setExpandedDocId(null);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    explorerCollection === 'mamas'
                      ? 'bg-purple-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mama&apos;s Savings ({mamasState.records.length})
                </button>
              </div>

              {/* Explorer Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by doc ID, date, category..."
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Document Path Indicator */}
            <div className="text-[11px] font-mono text-slate-500 bg-slate-50 rounded px-3 py-1.5 border border-slate-100 truncate">
              {explorerCollection === 'efund'
                ? `Firestore Path: /ledgers/${SHARED_LEDGER_ID}/transactions/*`
                : `Firestore Path: /mamas_savings/${MAMAS_SAVINGS_DOC_ID} (records array)`}
            </div>
          </div>

          {/* Document List View */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
            {explorerCollection === 'efund' ? (
              paginatedEfundDocs.map((tx) => {
                const isExpanded = expandedDocId === tx.id;
                return (
                  <div key={tx.id} className="p-3.5 sm:p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                          {tx.id}
                        </span>
                        <span className="font-mono text-xs text-slate-500 shrink-0">{tx.date}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {tx.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {formatPHP(tx.amountOnHand + tx.bpiMoneyMarket + tx.bpiShortTerm + (tx.memberLoan || 0))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedDocId(isExpanded ? null : tx.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 rounded text-slate-600 hover:bg-white hover:border-slate-400"
                        >
                          {isExpanded ? 'Hide Payload' : 'View Payload'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyDocJson(tx.id, tx)}
                          title="Copy JSON document"
                          className="p-1 border border-slate-200 rounded text-slate-500 hover:bg-white"
                        >
                          {copiedDocId === tx.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable JSON Document Viewer */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Raw Firestore Document Schema
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            rowRef: {tx.rowRef ?? '—'}
                          </span>
                        </div>
                        <pre className="rounded bg-slate-950 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                          {JSON.stringify(tx, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              paginatedMamasDocs.map((rec) => {
                const docKey = rec.id || `mamas-${rec.rowRef}`;
                const isExpanded = expandedDocId === docKey;
                const labels = normalizeMamasBucketLabels(mamasState.bucketLabels);
                const customBuckets = normalizeMamasCustomBuckets(mamasState.customBuckets);
                const customLabel = rec.customBucketId
                  ? customBuckets.find((b) => b.id === rec.customBucketId)?.label ||
                    'Custom Bucket'
                  : null;
                return (
                  <div key={docKey} className="p-3.5 sm:p-4 hover:bg-purple-50/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-purple-900 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                          {rec.date}
                        </span>
                        <span className="font-mono text-xs text-slate-500 shrink-0">{rec.displayDate}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {rec.notes || 'Mama savings record'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-purple-900">
                          {customLabel
                            ? `${customLabel}: ${formatPHP(rec.customAmount || 0)}`
                            : `${labels.investLabel}: ${formatPHP(rec.invest)} | ${labels.atmLabel}: ${formatPHP(rec.mamaAtm)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedDocId(isExpanded ? null : docKey)}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-purple-200 rounded text-purple-800 hover:bg-white"
                        >
                          {isExpanded ? 'Hide Payload' : 'View Payload'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyDocJson(docKey, rec)}
                          title="Copy JSON document"
                          className="p-1 border border-purple-200 rounded text-slate-500 hover:bg-white"
                        >
                          {copiedDocId === docKey ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-purple-100">
                        <pre className="rounded bg-slate-950 p-3 text-[11px] font-mono text-purple-300 overflow-x-auto">
                          {JSON.stringify(rec, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {((explorerCollection === 'efund' && filteredEfundDocs.length === 0) ||
              (explorerCollection === 'mamas' && filteredMamasDocs.length === 0)) && (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching Firestore documents found.
              </div>
            )}

            <PaginationBar
              currentPage={explorerPage}
              totalItems={
                explorerCollection === 'efund'
                  ? filteredEfundDocs.length
                  : filteredMamasDocs.length
              }
              pageSize={explorerPageSize}
              onPageChange={setExplorerPage}
              onPageSizeChange={setExplorerPageSize}
              pageSizeOptions={[10, 20, 50]}
              itemLabel="documents"
              accent={explorerCollection === 'mamas' ? 'purple' : 'slate'}
            />
          </div>
        </div>
      )}

      {/* TAB 3: RAW JSON PAYLOAD */}
      {activeTab === 'payload' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">
                Full Database JSON Snapshot ({EXPORT_JSON_FILENAME})
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({payloadSize.toLocaleString()} bytes)
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyFullPayload}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              {copiedPayload ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied JSON!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Full JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="max-h-[500px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs font-mono tabular-nums text-slate-200 leading-relaxed shadow-xs">
            {JSON.stringify(db, null, 2)}
          </pre>
        </div>
      )}

      {/* TAB 4: MASTER REFERENCE IMAGE */}
      {activeTab === 'reference' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Uploaded Master Spreadsheet Verification Reference
            </h3>
            <p className="text-xs text-slate-500">
              Original Excel ledger verification image confirming opening balances: ₱11,970.00 Cash on Hand · ₱78,000.00 Money Market Fund · ₱6,800.00 Short Term Fund.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2">
            <img
              src="/assets/aistudio/image_898f47ed.png"
              alt="Original Clan E-Fund record showing Date, Description, Amount on Hand, BPI Money Market Fund, and BPI Short Term columns"
              referrerPolicy="no-referrer"
              className="mx-auto max-h-[560px] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}

      {/* TAB 5: UNIT & PROBE DIAGNOSTIC TEST RUNNER */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Header & Execute Button */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Automated Unit Test &amp; Live Probe Test Suite
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Verifies deterministic accounting calculations, dynamic bucket normalization, RBAC security guards, and live Firestore connectivity probes.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {lastTestRunAt && (
                <span className="text-xs font-mono text-slate-500">
                  Last run: {lastTestRunAt}
                </span>
              )}
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={isRunningTests}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Running Probes...' : 'Re-Run All Tests'}</span>
              </button>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Unit Test Suite</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                  {unitResults.filter((r) => r.passed).length} / {unitResults.length}
                </span>
                <span className="text-xs font-semibold text-emerald-800">
                  {unitResults.every((r) => r.passed) ? '100% Passed' : 'Check Failures'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Accounting math, loan repayments, custom buckets, date serials &amp; RBAC rules
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Live Firestore &amp; Security Probes</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tabular-nums text-indigo-700">
                  {probeResults.filter((r) => r.passed).length} / {probeResults.length || 7}
                </span>
                <span className="text-xs font-semibold text-indigo-800">
                  {probeResults.length > 0 && probeResults.every((r) => r.passed)
                    ? 'All Probes Healthy'
                    : isRunningTests
                    ? 'Probing...'
                    : 'Ready'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Dual-Firebase routing, live document reads, 107-row anchor &amp; vault privacy
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">CLI Command Runner</div>
              <div className="mt-1.5 font-mono text-xs bg-slate-900 text-emerald-400 px-3 py-1.5 rounded select-all">
                npm test
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Executes <code className="font-mono">tsx src/tests/runTestsCli.ts</code> in terminal
              </p>
            </div>
          </div>

          {/* Live Probe Test Results Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Live Runtime &amp; Firestore Probe Tests (PT-01 to PT-07)
                </h4>
                <p className="text-xs text-slate-500">
                  Real-time asynchronous probes verifying Firestore collections, environment routing, Workspace OAuth scopes, and security isolation
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600">
                {probeResults.filter((r) => r.passed).length}/{probeResults.length} Passed
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {probeResults.map((pt) => (
                <div key={pt.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {pt.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
                        {pt.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        [{pt.category}]
                      </span>
                      <span className="text-xs font-bold text-slate-900">{pt.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {pt.durationMs} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs font-mono">
                    <div className="bg-slate-50 rounded px-3 py-1.5 border border-slate-100 text-slate-600 truncate">
                      <span className="font-semibold text-slate-400">Expected: </span>
                      {pt.expected}
                    </div>
                    <div
                      className={`rounded px-3 py-1.5 border truncate ${
                        pt.passed
                          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <span className="font-semibold opacity-70">Actual: </span>
                      {pt.actual}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deterministic Unit Test Results Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Deterministic Unit Tests (UT-01 to UT-12)
                </h4>
                <p className="text-xs text-slate-500">
                  Pure unit tests for 4-bucket accounting, loan receivable derivation, custom buckets, Google Sheets 2-tab backup matrices, and schema clamping
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600">
                {unitResults.filter((r) => r.passed).length}/{unitResults.length} Passed
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {unitResults.map((ut) => (
                <div key={ut.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {ut.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {ut.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        [{ut.category}]
                      </span>
                      <span className="text-xs font-bold text-slate-900">{ut.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {ut.durationMs} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs font-mono">
                    <div className="bg-slate-50 rounded px-3 py-1.5 border border-slate-100 text-slate-600 truncate">
                      <span className="font-semibold text-slate-400">Expected: </span>
                      {ut.expected}
                    </div>
                    <div
                      className={`rounded px-3 py-1.5 border truncate ${
                        ut.passed
                          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <span className="font-semibold opacity-70">Actual: </span>
                      {ut.actual}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
