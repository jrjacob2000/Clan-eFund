import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  ShieldCheck,
  Lock,
  PiggyBank,
  HeartPulse,
  ReceiptText,
  Plus,
  RefreshCw,
  Download,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowRight,
  Database,
  CheckCircle2,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firebaseDb';

interface HelpGuideViewProps {
  canManage: boolean;
  onOpenNewEntry: () => void;
  onNavigateToSection: (section: 'dashboard' | 'ledger' | 'contributors' | 'medical' | 'database') => void;
}

interface FaqItem {
  question: string;
  answer: string;
  category: 'general' | 'roles' | 'transactions' | 'technical';
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'general',
    question: 'What is the Clan Emergency Fund (E-Fund)?',
    answer:
      'The Clan Emergency Fund is a shared family reserve established to pool monthly contributions from clan members (Nene, Laura, Jonathan, Dondon, Joel, Jason, Iloy, Mhariz). Its primary purpose is to safeguard health and provide instant medical funding for Papa and Mama.'
  },
  {
    category: 'general',
    question: 'What is the Target Liquid Cash Floor (₱15,000.00)?',
    answer:
      'The Target Liquid Cash Floor is the minimum cash amount maintained in Cash on Hand (liquid buffer) at all times. Because bank investment funds (BPI Money Market / Short Term UITF) take 1-2 days to redeem, Cash on Hand acts as an immediate first line of defense to pay for emergency prescriptions, clinic fees, or lab tests without delay.'
  },
  {
    category: 'roles',
    question: 'What is the difference between Record Manager and Contributor Mode?',
    answer:
      `Record Manager Mode is restricted to Jonathan (${ADMIN_EMAIL}) upon Google Sign-In. The Record Manager can record, edit, and delete transactions, update cash reserve targets, and access the Database Console. Contributor Mode provides all other family members real-time, read-only access to verify balances and track contributions.`
  },
  {
    category: 'transactions',
    question: 'How do I log a member contribution?',
    answer:
      'If you are signed in as Record Manager, click the "+ Record Transaction" button in the top bar or use the "Quick Log" buttons on the Dashboard. Select "Contribution", pick the member (e.g., Nene, Laura), set the date and amount (e.g. ₱5,000 or ₱1,000), select the account bucket (Cash on Hand or BPI Money Market), and click Save.'
  },
  {
    category: 'transactions',
    question: 'How do Medical Disbursements work?',
    answer:
      'When logging a medical expense for Papa or Mama, choose "Medical" mode in the transaction window. Select the beneficiary (Papa, Mama, or Parents), enter the amount (e.g. ₱2,800), and check "Mark as urgent medical disbursement". Medical expenses deduct from Cash on Hand and are highlighted in red across the Activity ledger.'
  },
  {
    category: 'transactions',
    question: 'How are Member Loans and Repayments handled?',
    answer:
      'When the fund extends emergency loan assistance to a clan member, select "Lend Member". The amount leaves Cash on Hand and enters Member Loans Receivable. When the member pays back, select "Collect Loan" to collect funds back into Cash on Hand or BPI funds.'
  },
  {
    category: 'technical',
    question: 'How is data backed up and synced?',
    answer:
      'All transactions are saved in real time to Google Firebase Firestore database (/ledgers/clan-efund-main/transactions). Local storage caching ensures offline availability, and the Record Manager can download a full JSON backup file or CSV export at any time from the Database Console.'
  }
];

export const HelpGuideView: React.FC<HelpGuideViewProps> = ({
  canManage,
  onOpenNewEntry,
  onNavigateToSection
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState<string>('all');

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    if (faqCategory !== 'all' && item.category !== faqCategory) return false;
    if (faqSearch.trim()) {
      const q = faqSearch.toLowerCase();
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Clan E-Fund Ledger Guide &amp; Help Center
              </h1>
              <p className="text-xs text-slate-500">
                Complete guide to understanding family balances, medical reserves, roles, and recording rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToSection('dashboard')}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Go to Dashboard
            </button>
            {canManage && (
              <button
                type="button"
                onClick={onOpenNewEntry}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <button
            type="button"
            onClick={() => onNavigateToSection('ledger')}
            className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-left transition-colors space-y-1 group"
          >
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ReceiptText className="h-4 w-4 text-slate-600" />
                <span>Activity &amp; Ledger</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-slate-500 text-[11px]">
              Browse all 107 historical rows, filter by Year (2026-2024), Month, or Account Bucket.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection('contributors')}
            className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-left transition-colors space-y-1 group"
          >
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-700" />
                <span>Contributors &amp; Matrix</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-slate-500 text-[11px]">
              View active member contribution rankings and multi-year monthly contribution cadence.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection('medical')}
            className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-left transition-colors space-y-1 group"
          >
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HeartPulse className="h-4 w-4 text-red-600" />
                <span>Medical &amp; Investments</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-slate-500 text-[11px]">
              Analyze gross medical outflows for Papa &amp; Mama and BPI bank fund yield reserves.
            </p>
          </button>
        </div>
      </div>

      {/* SECTION 1: ACCOUNT STRUCTURE & 4 CUSTODY BUCKETS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-700" />
            <span>Understanding the 4 Account Buckets</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every transaction in the Clan E-Fund routes capital across 4 distinct financial buckets
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 p-4 space-y-1.5 bg-slate-50/50">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span>1. Cash on Hand</span>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                Liquid Buffer
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Immediate physical/cash buffer maintained for sudden medical emergencies, prescriptions, or doctor consultations. Target floor: ₱15,000.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-1.5 bg-slate-50/50">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span>2. Money Market Fund</span>
              <span className="text-[10px] font-semibold text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded">
                BPI Bank UITF
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Yield-bearing BPI trust investment fund where surplus clan capital accumulates interest. T+1 business day liquidity for redemptions.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-1.5 bg-slate-50/50">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span>3. Short Term Fund</span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                BPI Secondary
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Secondary capital preservation fund at BPI for long-term emergency growth and reserve stability.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 p-4 space-y-1.5 bg-amber-50/40">
            <div className="font-bold text-amber-950 flex items-center justify-between">
              <span>4. Member Loans</span>
              <span className="text-[10px] font-semibold text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded">
                Receivable
              </span>
            </div>
            <p className="text-amber-900 leading-relaxed">
              Outstanding loan assistance extended from the fund to clan members, tracked until repayment is collected back.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-slate-700" />
            <span>Frequently Asked Questions (FAQ)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quick answers to common questions about ledger operations, calculations, and security
          </p>
        </div>

        {/* FAQ Search & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {[
              ['all', 'All Topics'],
              ['general', 'General'],
              ['roles', 'Roles'],
              ['transactions', 'Transactions'],
              ['technical', 'Sync & DB']
            ].map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setFaqCategory(catKey)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  faqCategory === catKey
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {catLabel}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={faq.question} className="py-3">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 text-left py-1 text-xs font-bold text-slate-900 hover:text-emerald-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{faq.question}</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-2 pl-6 pr-2 text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}

          {filteredFaqs.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              No help topics found matching your query.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: CONTACT & SUPPORT */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
            <span>Need Additional Assistance or Audit Verification?</span>
          </h3>
          <p className="text-xs text-slate-300">
            For ledger adjustments, prior spreadsheet reconciliations, or access assistance, contact Record Manager Jonathan (<span className="font-mono text-emerald-300">{ADMIN_EMAIL}</span>).
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToSection('dashboard')}
          className="px-4 py-2.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold whitespace-nowrap transition-colors shrink-0"
        >
          Return to Dashboard →
        </button>
      </div>
    </div>
  );
};
