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
  FileSpreadsheet
} from 'lucide-react';
import { ClanEFundDatabase, MamasSavingsState, formatPHP } from '../data/initialLedger';
import { ADMIN_EMAIL, EXPORT_JSON_FILENAME, FIRESTORE_DATABASE_ID, SHARED_LEDGER_ID } from '../services/firebaseDb';

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

type DbConsoleTab = 'overview' | 'explorer' | 'payload' | 'reference';

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
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Database className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Firestore Database Management Console
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Project ID: <strong className="text-slate-800">clan-e-fund-ledger</strong> · DB ID:{' '}
              <strong className="text-slate-800">{FIRESTORE_DATABASE_ID}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://console.firebase.google.com/u/0/project/clan-e-fund-ledger/firestore"
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

          {/* Master Google Spreadsheet Link Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Source Master Google Drive Spreadsheet
                  </h3>
                  <p className="text-xs text-emerald-700">
                    File ID: <span className="font-mono">1e2xMLl7nXYC_uq5eS3UsoSVWvND9NFO_</span>
                  </p>
                </div>
              </div>
              <a
                href="https://docs.google.com/spreadsheets/d/1e2xMLl7nXYC_uq5eS3UsoSVWvND9NFO_/edit?usp=drivesdk&ouid=102647529945100411940&rtpof=true&sd=true"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-md bg-emerald-800 text-white hover:bg-emerald-900 transition-colors text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <span>Open in Google Sheets</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3.5 border border-emerald-100 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Sheet 1: E-Fund (Emergency Fund)</span>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Shared Ledger
                  </span>
                </div>
                <div className="text-slate-600 text-xs">
                  107 historical rows fully populated into Firestore path:{' '}
                  <span className="font-mono text-slate-800">/ledgers/{SHARED_LEDGER_ID}/transactions</span>.
                </div>
                <div className="font-mono text-emerald-800 font-bold text-xs pt-1">
                  ₱96,770.00 Total Net Balance
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
                  18 records populated into Firestore path:{' '}
                  <span className="font-mono text-slate-800">/mamas_savings/{ADMIN_EMAIL}</span>.
                </div>
                <div className="font-mono text-purple-900 font-bold text-xs pt-1">
                  {formatPHP(mamasState.totalSavings)} Cumulative Savings Balance
                </div>
              </div>
            </div>
          </div>
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
                : `Firestore Path: /mamas_savings/${ADMIN_EMAIL}/*`}
            </div>
          </div>

          {/* Document List View */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
            {explorerCollection === 'efund' ? (
              filteredEfundDocs.map((tx) => {
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
              filteredMamasDocs.map((rec) => {
                const docKey = rec.id || `mamas-${rec.rowRef}`;
                const isExpanded = expandedDocId === docKey;
                return (
                  <div key={docKey} className="p-3.5 sm:p-4 hover:bg-purple-50/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-purple-900 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                          Row {rec.rowRef}
                        </span>
                        <span className="font-mono text-xs text-slate-500 shrink-0">{rec.displayDate}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {rec.notes || 'Mama savings record'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-purple-900">
                          Invest: {formatPHP(rec.invest)} | ATM: {formatPHP(rec.mamaAtm)}
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
    </div>
  );
};
