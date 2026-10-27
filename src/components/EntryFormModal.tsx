import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { EFundTransaction, EntryCategory, formatPHP } from '../data/initialLedger';

export type EntryPresetMode =
  | 'contribution'
  | 'medical'
  | 'reimbursement'
  | 'transfer'
  | 'yield'
  | 'loan'
  | 'loan_repayment'
  | 'custom';

interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<EFundTransaction, 'id'>, existingId?: string, newMember?: string) => void;
  editingEntry?: EFundTransaction | null;
  members: string[];
  presetMember?: string | null;
  presetMode?: EntryPresetMode;
  presetDate?: string | null;
  isSaving?: boolean;
}

type AccountTarget = 'amountOnHand' | 'bpiMoneyMarket' | 'bpiShortTerm';

export const EntryFormModal: React.FC<EntryFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEntry,
  members,
  presetMember,
  presetMode = 'contribution',
  presetDate = null,
  isSaving = false
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<EntryPresetMode>(presetMode);
  const [date, setDate] = useState(presetDate || todayStr);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EntryCategory>('Contribution');
  const [memberOrBeneficiary, setMemberOrBeneficiary] = useState('Nene');
  const [customMember, setCustomMember] = useState('');

  // Quick mode fields
  const [quickAmount, setQuickAmount] = useState('5000');
  const [targetAccount, setTargetAccount] = useState<AccountTarget>('amountOnHand');
  const [transferFrom, setTransferFrom] = useState<AccountTarget>('amountOnHand');
  const [transferTo, setTransferTo] = useState<AccountTarget>('bpiMoneyMarket');

  // Direct account values (4 Buckets)
  const [amountOnHand, setAmountOnHand] = useState<number>(5000);
  const [bpiMoneyMarket, setBpiMoneyMarket] = useState<number>(0);
  const [bpiShortTerm, setBpiShortTerm] = useState<number>(0);
  const [memberLoan, setMemberLoan] = useState<number>(0);
  const [highlightAlert, setHighlightAlert] = useState(false);
  const [notes, setNotes] = useState('');

  // Prevent background page scrolling on mobile when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingEntry) {
      setMode('custom');
      setDate(editingEntry.date);
      setDescription(editingEntry.description);
      setCategory(editingEntry.category);
      setMemberOrBeneficiary(editingEntry.memberOrBeneficiary);
      setAmountOnHand(editingEntry.amountOnHand);
      setBpiMoneyMarket(editingEntry.bpiMoneyMarket);
      setBpiShortTerm(editingEntry.bpiShortTerm);
      setMemberLoan(editingEntry.memberLoan || 0);
      setHighlightAlert(Boolean(editingEntry.highlightAlert));
      setNotes(editingEntry.notes || '');
      return;
    }

    setMode(presetMode);
    setDate(presetDate || todayStr);
    const defaultMember = presetMember || members[0] || 'Nene';
    setMemberOrBeneficiary(defaultMember);
    setCustomMember('');

    if (presetMode === 'contribution') {
      setCategory('Contribution');
      setDescription(defaultMember);
      const defaultAmt = defaultMember === 'Nene' ? '5000' : '1000';
      setQuickAmount(defaultAmt);
      setTargetAccount('amountOnHand');
      setAmountOnHand(Number(defaultAmt));
      setBpiMoneyMarket(0);
      setBpiShortTerm(0);
      setMemberLoan(0);
      setHighlightAlert(false);
      setNotes('');
    } else if (presetMode === 'medical') {
      const targetParent =
        presetMember === 'Mama' || presetMember === 'Parents' ? presetMember : 'Papa';
      setCategory('Medical Disbursement');
      setMemberOrBeneficiary(targetParent);
      setDescription(
        targetParent === 'Mama'
          ? 'Gamot at check up ni Mama'
          : targetParent === 'Parents'
          ? 'Parents medical check-up & medicines'
          : 'Gamot at check up ni Papa'
      );
      setQuickAmount('2800');
      setTargetAccount('amountOnHand');
      setAmountOnHand(-2800);
      setBpiMoneyMarket(0);
      setBpiShortTerm(0);
      setMemberLoan(0);
      setHighlightAlert(true);
      setNotes('');
    } else if (presetMode === 'reimbursement') {
      setCategory('Reimbursement');
      setMemberOrBeneficiary(presetMember || 'Dondon');
      setDescription(`${presetMember || 'Dondon'}'s medical reimbursement`);
      setQuickAmount('2000');
      setTargetAccount('amountOnHand');
      setAmountOnHand(2000);
      setBpiMoneyMarket(0);
      setBpiShortTerm(0);
      setMemberLoan(0);
      setHighlightAlert(false);
      setNotes('Emergency medical reimbursement to replenish Cash on Hand');
    } else if (presetMode === 'transfer') {
      setCategory('Internal Transfer');
      setMemberOrBeneficiary('BPI Funds');
      setDescription('Transfer to Money Market Fund');
      setQuickAmount('10000');
      setTransferFrom('amountOnHand');
      setTransferTo('bpiMoneyMarket');
      setAmountOnHand(-10000);
      setBpiMoneyMarket(10000);
      setBpiShortTerm(0);
      setMemberLoan(0);
      setHighlightAlert(false);
      setNotes('');
    } else if (presetMode === 'yield') {
      setCategory('Investment Yield');
      setMemberOrBeneficiary('BPI Funds');
      setDescription('Money Market Fund Yield');
      setQuickAmount('450');
      setTargetAccount('bpiMoneyMarket');
      setAmountOnHand(0);
      setBpiMoneyMarket(450);
      setBpiShortTerm(0);
      setMemberLoan(0);
      setHighlightAlert(false);
      setNotes('Accrued investment return / NAVPU gain');
    } else if (presetMode === 'loan') {
      setCategory('Member Loan');
      setMemberOrBeneficiary(defaultMember);
      setDescription(`Lent to ${defaultMember}`);
      setQuickAmount('5000');
      setTargetAccount('amountOnHand');
      setAmountOnHand(-5000);
      setBpiMoneyMarket(0);
      setBpiShortTerm(0);
      setMemberLoan(5000);
      setHighlightAlert(false);
      setNotes('Member loan assistance extended from E-Fund cash');
    } else if (presetMode === 'loan_repayment') {
      setCategory('Loan Repayment');
      setMemberOrBeneficiary(defaultMember);
      setDescription(`Loan payment collected from ${defaultMember}`);
      setQuickAmount('5000');
      setTargetAccount('amountOnHand');
      setAmountOnHand(5000);
      setBpiMoneyMarket(0);
      setBpiShortTerm(0);
      setMemberLoan(-5000);
      setHighlightAlert(false);
      setNotes('Collected member loan repayment back into Cash on Hand');
    }
  }, [isOpen, editingEntry, presetMember, presetMode, presetDate, members, todayStr]);

  useEffect(() => {
    if (mode === 'custom') return;
    const numericAmt = Math.abs(parseFloat(quickAmount) || 0);

    if (mode === 'contribution') {
      setCategory('Contribution');
      setAmountOnHand(targetAccount === 'amountOnHand' ? numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? numericAmt : 0);
      setMemberLoan(0);
    } else if (mode === 'reimbursement') {
      setCategory('Reimbursement');
      setAmountOnHand(targetAccount === 'amountOnHand' ? numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? numericAmt : 0);
      setMemberLoan(0);
    } else if (mode === 'yield') {
      setCategory('Investment Yield');
      setAmountOnHand(targetAccount === 'amountOnHand' ? numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? numericAmt : 0);
      setMemberLoan(0);
    } else if (mode === 'medical') {
      setCategory('Medical Disbursement');
      setAmountOnHand(targetAccount === 'amountOnHand' ? -numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? -numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? -numericAmt : 0);
      setMemberLoan(0);
    } else if (mode === 'loan') {
      setCategory('Member Loan');
      // Money leaves selected liquid/bank account and enters Member Loan receivable bucket
      setAmountOnHand(targetAccount === 'amountOnHand' ? -numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? -numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? -numericAmt : 0);
      setMemberLoan(numericAmt);
    } else if (mode === 'loan_repayment') {
      setCategory('Loan Repayment');
      // Repayment is collected into selected liquid/bank account, reducing Member Loan receivable
      setAmountOnHand(targetAccount === 'amountOnHand' ? numericAmt : 0);
      setBpiMoneyMarket(targetAccount === 'bpiMoneyMarket' ? numericAmt : 0);
      setBpiShortTerm(targetAccount === 'bpiShortTerm' ? numericAmt : 0);
      setMemberLoan(-numericAmt);
    } else if (mode === 'transfer') {
      setCategory('Internal Transfer');
      let onHand = 0;
      let mmf = 0;
      let st = 0;
      if (transferFrom === 'amountOnHand') onHand -= numericAmt;
      if (transferFrom === 'bpiMoneyMarket') mmf -= numericAmt;
      if (transferFrom === 'bpiShortTerm') st -= numericAmt;

      if (transferTo === 'amountOnHand') onHand += numericAmt;
      if (transferTo === 'bpiMoneyMarket') mmf += numericAmt;
      if (transferTo === 'bpiShortTerm') st += numericAmt;

      setAmountOnHand(onHand);
      setBpiMoneyMarket(mmf);
      setBpiShortTerm(st);
      setMemberLoan(0);
    }
  }, [mode, quickAmount, targetAccount, transferFrom, transferTo]);

  if (!isOpen) return null;

  const formatDisplayDate = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `${month}/${day}/${year}`;
  };

  const handleTransferFromChange = (newFrom: AccountTarget) => {
    setTransferFrom(newFrom);
    if (newFrom === transferTo) {
      setTransferTo(newFrom === 'amountOnHand' ? 'bpiMoneyMarket' : 'amountOnHand');
    }
  };

  const handleTransferToChange = (newTo: AccountTarget) => {
    setTransferTo(newTo);
    if (newTo === transferFrom) {
      setTransferFrom(newTo === 'amountOnHand' ? 'bpiMoneyMarket' : 'amountOnHand');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedMember =
      memberOrBeneficiary === '__NEW__' && customMember.trim()
        ? customMember.trim()
        : memberOrBeneficiary;

    const finalDescription = description.trim() || resolvedMember || 'Ledger Entry';

    onSave(
      {
        rowRef: editingEntry?.rowRef,
        date,
        displayDate:
          editingEntry?.displayDate && editingEntry.date === date
            ? editingEntry.displayDate
            : formatDisplayDate(date),
        description: finalDescription,
        category,
        memberOrBeneficiary: resolvedMember,
        amountOnHand: Number(amountOnHand) || 0,
        bpiMoneyMarket: Number(bpiMoneyMarket) || 0,
        bpiShortTerm: Number(bpiShortTerm) || 0,
        memberLoan: Number(memberLoan) || 0,
        highlightAlert,
        notes: notes.trim() || undefined
      },
      editingEntry?.id,
      memberOrBeneficiary === '__NEW__' && customMember.trim() ? customMember.trim() : undefined
    );
  };

  const netFundChange =
    (Number(amountOnHand) || 0) +
    (Number(bpiMoneyMarket) || 0) +
    (Number(bpiShortTerm) || 0) +
    (Number(memberLoan) || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[88vh] sm:rounded-lg">
        {/* Mobile grab handle indicator */}
        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Sticky Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg truncate">
              {editingEntry ? 'Edit Transaction' : 'Record E-Fund Transaction'}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              Log a contribution, medical expense, bank investment, or member loan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {/* Scrollable Form Body + Sticky Action Footer */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 space-y-4">
            {/* Segmented Entry Mode Selector (grid on mobile, flex wrap on desktop) */}
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => {
                  setMode('contribution');
                  setMemberOrBeneficiary(members[0] || 'Nene');
                  setDescription(members[0] || 'Nene');
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'contribution'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Contribution
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('medical');
                  setMemberOrBeneficiary('Papa');
                  setDescription('Gamot at check up ni Papa');
                  setHighlightAlert(true);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'medical'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Medical
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reimbursement');
                  setMemberOrBeneficiary('Dondon');
                  setDescription("Dondon's medical reimbursement");
                  setTargetAccount('amountOnHand');
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'reimbursement'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Reimburse
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('transfer');
                  setMemberOrBeneficiary('BPI Funds');
                  setDescription('Transfer to Money Market Fund');
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'transfer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Transfer
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('yield');
                  setMemberOrBeneficiary('BPI Funds');
                  setDescription('Money Market Fund Yield');
                  setTargetAccount('bpiMoneyMarket');
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'yield'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yield
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('loan');
                  setMemberOrBeneficiary(members[0] || 'Dondon');
                  setDescription(`Lent to ${members[0] || 'Dondon'}`);
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'loan'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:text-amber-900 bg-amber-50/60'
                }`}
              >
                Lend Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('loan_repayment');
                  setMemberOrBeneficiary(members[0] || 'Dondon');
                  setDescription(`Loan payment collected from ${members[0] || 'Dondon'}`);
                  setHighlightAlert(false);
                }}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'loan_repayment'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-800 hover:text-emerald-900 bg-emerald-50/60'
                }`}
              >
                Collect Loan
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`rounded-md px-2 py-2 sm:py-1.5 sm:flex-1 text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  mode === 'custom'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom Split
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {mode === 'medical' ? 'Parent Beneficiary' : 'Clan Member / Source'}
                </label>
                <select
                  value={memberOrBeneficiary}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMemberOrBeneficiary(val);
                    if (mode === 'contribution' && val !== '__NEW__') {
                      setDescription(val);
                      if (val === 'Nene') setQuickAmount('5000');
                      else setQuickAmount('1000');
                    } else if (mode === 'medical') {
                      if (val === 'Mama') setDescription('Gamot at check up ni Mama');
                      else if (val === 'Papa') setDescription('Gamot at check up ni Papa');
                      else if (val === 'Parents') setDescription('Parents check-up & medicines');
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                >
                  <optgroup label="Parents (Medical Beneficiaries)">
                    <option value="Papa">Papa (Medical Beneficiary)</option>
                    <option value="Mama">Mama (Medical Beneficiary)</option>
                    <option value="Parents">Parents (Papa &amp; Mama)</option>
                  </optgroup>
                  <optgroup label="Clan Contributors">
                    {members.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Investments & Other">
                    <option value="BPI Funds">Bank / Investment Fund</option>
                    <option value="__NEW__">+ Add New Clan Member / Bank...</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {memberOrBeneficiary === '__NEW__' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Clan Member / Bank Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Carlo or Metrobank UITF"
                  value={customMember}
                  onChange={(e) => {
                    setCustomMember(e.target.value);
                    if (mode === 'contribution') setDescription(e.target.value);
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Title / Description
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Nene, Gamot ni Papa, Transfer to Money Market"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
              />
              {mode === 'medical' && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {[
                    `Gamot ni ${memberOrBeneficiary === 'Mama' ? 'Mama' : 'Papa'}`,
                    `${memberOrBeneficiary === 'Mama' ? 'Mama' : 'Papa'} checkup & labs`,
                    `${memberOrBeneficiary === 'Mama' ? 'Mama' : 'Papa'} checkup/xray`,
                    'Parents maintenance medicine'
                  ].map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setDescription(template)}
                      className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 hover:bg-white"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode !== 'custom' ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 sm:p-4 space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount (PHP ₱)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      required
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-hidden"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {['1000', '2000', '3000', '5000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuickAmount(preset)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono tabular-nums text-slate-700 hover:border-slate-400 hover:text-slate-900 active:bg-slate-100"
                        >
                          ₱{Number(preset).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mode !== 'transfer' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Bucket
                      </label>
                      <select
                        value={targetAccount}
                        onChange={(e) => setTargetAccount(e.target.value as AccountTarget)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                      >
                        <option value="amountOnHand">Cash on Hand (Liquid)</option>
                        <option value="bpiMoneyMarket">Money Market Fund (BPI / Bank)</option>
                        <option value="bpiShortTerm">Short Term Fund (BPI / Bank)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Move From Account
                        </label>
                        <select
                          value={transferFrom}
                          onChange={(e) => handleTransferFromChange(e.target.value as AccountTarget)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900"
                        >
                          <option value="amountOnHand">Cash on Hand</option>
                          <option value="bpiMoneyMarket">Money Market Fund (BPI / Bank)</option>
                          <option value="bpiShortTerm">Short Term Fund (BPI / Bank)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Move To Account
                        </label>
                        <select
                          value={transferTo}
                          onChange={(e) => handleTransferToChange(e.target.value as AccountTarget)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900"
                        >
                          <option value="bpiMoneyMarket">Money Market Fund (BPI / Bank)</option>
                          <option value="bpiShortTerm">Short Term Fund (BPI / Bank)</option>
                          <option value="amountOnHand">Cash on Hand</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Account Bucket Adjustments (Use `-` for outflows)
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EntryCategory)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-base sm:text-xs text-slate-700"
                  >
                    <option value="Contribution">Contribution</option>
                    <option value="Medical Disbursement">Medical Disbursement</option>
                    <option value="Internal Transfer">Internal Transfer</option>
                    <option value="Reimbursement">Reimbursement</option>
                    <option value="Investment Yield">Investment Yield</option>
                    <option value="Member Loan">Member Loan (Lent)</option>
                    <option value="Loan Repayment">Loan Repayment (Collected)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Cash on Hand
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={amountOnHand}
                      onChange={(e) => setAmountOnHand(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 sm:py-1.5 text-base sm:text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Money Market Fund
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={bpiMoneyMarket}
                      onChange={(e) => setBpiMoneyMarket(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 sm:py-1.5 text-base sm:text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Short Term Fund
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={bpiShortTerm}
                      onChange={(e) => setBpiShortTerm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 sm:py-1.5 text-base sm:text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Member Loans (Receivable)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={memberLoan}
                      onChange={(e) => setMemberLoan(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-amber-300 bg-amber-50/50 px-2.5 py-2 sm:py-1.5 text-base sm:text-sm font-mono tabular-nums text-amber-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Resulting Transaction Summary (Stacks cleanly on mobile, 4-col on desktop) */}
            <div className="rounded-md border border-slate-200 px-3.5 py-3 sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-medium text-slate-500 mb-2">
                <span>Account Impact Summary</span>
                <span>
                  Net Fund Change:{' '}
                  <strong
                    className={`font-mono tabular-nums ${
                      netFundChange > 0
                        ? 'text-emerald-700'
                        : netFundChange < 0
                        ? 'text-red-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {netFundChange > 0 ? `+${formatPHP(netFundChange)}` : formatPHP(netFundChange)}
                  </strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 text-xs">
                <div className="flex flex-col rounded bg-slate-50 px-2.5 py-1.5">
                  <div className="text-slate-500 text-[11px]">Cash on Hand</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      amountOnHand < 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {formatPHP(amountOnHand, true)}
                  </div>
                </div>
                <div className="flex flex-col rounded bg-slate-50 px-2.5 py-1.5">
                  <div className="text-slate-500 text-[11px]">Money Market</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      bpiMoneyMarket < 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {formatPHP(bpiMoneyMarket, true)}
                  </div>
                </div>
                <div className="flex flex-col rounded bg-slate-50 px-2.5 py-1.5">
                  <div className="text-slate-500 text-[11px]">Short Term</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      bpiShortTerm < 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {formatPHP(bpiShortTerm, true)}
                  </div>
                </div>
                <div className="flex flex-col rounded bg-amber-50/70 border border-amber-200 px-2.5 py-1.5">
                  <div className="text-amber-800 text-[11px]">Member Loans</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      memberLoan > 0 ? 'text-amber-800' : memberLoan < 0 ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {formatPHP(memberLoan, true)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 py-1 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightAlert}
                  onChange={(e) => setHighlightAlert(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>Mark as urgent medical disbursement</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Note
              </label>
              <input
                type="text"
                placeholder="Optional receipt details, clinic name, or bank reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-700 disabled:opacity-80 whitespace-nowrap flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <span>{editingEntry ? 'Save Changes' : 'Record Transaction'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
