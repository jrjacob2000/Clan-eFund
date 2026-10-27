export type EntryCategory =
  | 'Contribution'
  | 'Medical Disbursement'
  | 'Internal Transfer'
  | 'Reimbursement'
  | 'Investment Yield'
  | 'Opening Balance'
  | 'Member Loan'
  | 'Loan Repayment';

export interface EFundTransaction {
  id: string;
  rowRef?: number;
  date: string; // YYYY-MM-DD
  displayDate: string; // Original spreadsheet notation or formatted date
  description: string;
  category: EntryCategory;
  memberOrBeneficiary: string;
  amountOnHand: number;
  bpiMoneyMarket: number;
  bpiShortTerm: number;
  memberLoan?: number; // Outstanding loan receivable from clan member
  highlightAlert?: boolean;
  notes?: string;
}

export interface MemberMonthlyTarget {
  member: string;
  monthlyTarget: number;
}

export interface MamasSavingsEntry {
  id?: string;
  rowRef: number;
  date: string;
  displayDate: string;
  invest: number;
  mamaAtm: number;
  notes?: string;
}

export interface MamasSavingsState {
  title: string;
  investBalance: number;
  mamaAtmBalance: number;
  loanToMhariz: number;
  totalSavings: number;
  lastUpdated?: string;
  records: MamasSavingsEntry[];
}

export interface ClanEFundDatabase {
  schemaVersion: number;
  clanName: string;
  currency: string;
  lastUpdated: string;
  updatedBy?: string;
  cashReserveTarget?: number;
  bpiActualMarketValue?: {
    bpiMoneyMarket: number;
    bpiShortTerm: number;
    asOfDate: string;
  };
  memberTargets?: MemberMonthlyTarget[];
  priorBalanceForward: {
    included: boolean;
    label: string;
    date: string;
    amountOnHand: number;
    bpiMoneyMarket: number;
    bpiShortTerm: number;
    notes: string;
  };
  members: string[];
  transactions: EFundTransaction[];
}

export const MAMAS_SAVINGS_DATA: MamasSavingsState = {
  title: "Mama's Savings",
  investBalance: 8200.0,
  mamaAtmBalance: 15000.0,
  loanToMhariz: 40000.0,
  totalSavings: 63200.0,
  records: [
  {
    "rowRef": 3,
    "date": "2025-06-30",
    "displayDate": "45838.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 4,
    "date": "2025-07-29",
    "displayDate": "45867.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 5,
    "date": "2025-08-29",
    "displayDate": "45898.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 6,
    "date": "2025-09-30",
    "displayDate": "45930.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 7,
    "date": "2025-10-28",
    "displayDate": "45958.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 8,
    "date": "2025-11-27",
    "displayDate": "11/27/25",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 9,
    "date": "2025-12-30",
    "displayDate": "46021.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 10,
    "date": "2026-01-28",
    "displayDate": "46050.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 11,
    "date": "2026-02-28",
    "displayDate": "46081.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 12,
    "date": "2026-03-28",
    "displayDate": "46109.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 13,
    "date": "2026-04-09",
    "displayDate": "46121.0",
    "invest": -16800.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 14,
    "date": "2026-04-27",
    "displayDate": "46139.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 15,
    "date": "2026-05-27",
    "displayDate": "46169.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 16,
    "date": "2026-06-30",
    "displayDate": "46203.0",
    "invest": 5000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 17,
    "date": "2026-07-29",
    "displayDate": "46232.0",
    "invest": 0.0,
    "mamaAtm": 5000.0,
    "notes": ""
  },
  {
    "rowRef": 18,
    "date": "2026-08-04",
    "displayDate": "46238.0",
    "invest": -40000.0,
    "mamaAtm": 0.0,
    "notes": ""
  },
  {
    "rowRef": 19,
    "date": "2026-08-30",
    "displayDate": "46264.0",
    "invest": 0.0,
    "mamaAtm": 5000.0,
    "notes": ""
  },
  {
    "rowRef": 20,
    "date": "2026-09-30",
    "displayDate": "46295.0",
    "invest": 0.0,
    "mamaAtm": 5000.0,
    "notes": ""
  }
] as MamasSavingsEntry[]
};

export const EMPTY_MAMAS_SAVINGS_STATE: MamasSavingsState = {
  title: "Mama's Savings (Private)",
  investBalance: 0,
  mamaAtmBalance: 0,
  loanToMhariz: 0,
  totalSavings: 0,
  records: []
};

export const INITIAL_EFUND_DB: ClanEFundDatabase = {
  schemaVersion: 3,
  clanName: 'Clan Emergency Fund (E-Fund)',
  currency: 'PHP',
  lastUpdated: '2026-10-26T08:00:00.000Z',
  cashReserveTarget: 15000.0,
  bpiActualMarketValue: {
    bpiMoneyMarket: 78000.0,
    bpiShortTerm: 6800.0,
    asOfDate: '2026-10-26'
  },
  memberTargets: [
    { member: 'Nene', monthlyTarget: 5000 },
    { member: 'Laura', monthlyTarget: 1000 },
    { member: 'Jonathan', monthlyTarget: 1000 },
    { member: 'Dondon', monthlyTarget: 1000 },
    { member: 'Joel', monthlyTarget: 1000 },
    { member: 'Jason', monthlyTarget: 500 },
    { member: 'Iloy', monthlyTarget: 500 },
    { member: 'Mhariz', monthlyTarget: 1000 }
  ],
  priorBalanceForward: {
    included: false,
    label: 'Initial Ledger State',
    date: '2024-01-01',
    amountOnHand: 0,
    bpiMoneyMarket: 0,
    bpiShortTerm: 0,
    notes: 'All 107 transactions from January 2024 to October 2026 are fully migrated from the master spreadsheet.'
  },
  members: [
    'Nene',
    'Laura',
    'Jonathan',
    'Dondon',
    'Mhariz',
    'Jason',
    'Joel',
    'Iloy'
  ],
  transactions: [
  {
    "id": "row-4",
    "rowRef": 4,
    "date": "2024-01-27",
    "displayDate": "1/27/2024",
    "description": "Payment c/o Mhariz",
    "category": "Contribution",
    "memberOrBeneficiary": "Mhariz",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Payment c/o Mhariz"
  },
  {
    "id": "row-5",
    "rowRef": 5,
    "date": "2024-02-08",
    "displayDate": "2/8/2024",
    "description": "Jason",
    "category": "Contribution",
    "memberOrBeneficiary": "Jason",
    "amountOnHand": 100.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Family contribution from Jason"
  },
  {
    "id": "row-6",
    "rowRef": 6,
    "date": "2024-02-18",
    "displayDate": "2/18/2024",
    "description": "Payment c/o Mhariz",
    "category": "Contribution",
    "memberOrBeneficiary": "Mhariz",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Payment c/o Mhariz"
  },
  {
    "id": "row-7",
    "rowRef": 7,
    "date": "2024-02-28",
    "displayDate": "2/28/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 2000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-8",
    "rowRef": 8,
    "date": "2024-04-18",
    "displayDate": "4/18/2024",
    "description": "Payment c/o Mhariz",
    "category": "Contribution",
    "memberOrBeneficiary": "Mhariz",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Payment c/o Mhariz"
  },
  {
    "id": "row-9",
    "rowRef": 9,
    "date": "2024-04-30",
    "displayDate": "4/30/2024",
    "description": "Jason",
    "category": "Contribution",
    "memberOrBeneficiary": "Jason",
    "amountOnHand": 500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Family contribution from Jason"
  },
  {
    "id": "row-10",
    "rowRef": 10,
    "date": "2024-05-01",
    "displayDate": "5/1/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 3020.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-11",
    "rowRef": 11,
    "date": "2024-05-03",
    "displayDate": "5/3/2024",
    "description": "Invest to Trust Fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -21000.0,
    "bpiMoneyMarket": 21000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-12",
    "rowRef": 12,
    "date": "2024-05-27",
    "displayDate": "5/27/2024",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 1000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-13",
    "rowRef": 13,
    "date": "2024-05-14",
    "displayDate": "5/14/2024",
    "description": "Mama Medicine (Pronerv)",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Mama",
    "amountOnHand": -1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Mama Medicine (Pronerv)"
  },
  {
    "id": "row-15",
    "rowRef": 15,
    "date": "2024-05-30",
    "displayDate": "5/30/2024",
    "description": "Transfer to Trust Fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -4000.0,
    "bpiMoneyMarket": 4000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Allocation between Cash on Hand and BPI Trust Fund"
  },
  {
    "id": "row-16",
    "rowRef": 16,
    "date": "2024-06-19",
    "displayDate": "6/19/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-17",
    "rowRef": 17,
    "date": "2024-06-28",
    "displayDate": "6/28/2024",
    "description": "nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 200.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-18",
    "rowRef": 18,
    "date": "2024-07-03",
    "displayDate": "7/3/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-19",
    "rowRef": 19,
    "date": "2024-07-06",
    "displayDate": "7/6/2024",
    "description": "nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-20",
    "rowRef": 20,
    "date": "2024-07-12",
    "displayDate": "7/12/2024",
    "description": "Invest to Trust Fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -5000.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-21",
    "rowRef": 21,
    "date": "2024-07-19",
    "displayDate": "7/19/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-22",
    "rowRef": 22,
    "date": "2024-07-30",
    "displayDate": "7/30/2024",
    "description": "Transfer to Trust Fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -5000.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Allocation between Cash on Hand and BPI Trust Fund"
  },
  {
    "id": "row-23",
    "rowRef": 23,
    "date": "2024-08-29",
    "displayDate": "8/29/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 3000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-24",
    "rowRef": 24,
    "date": "2024-09-06",
    "displayDate": "9/6/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-25",
    "rowRef": 25,
    "date": "2024-09-29",
    "displayDate": "9/29/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 3800.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-26",
    "rowRef": 26,
    "date": "2024-09-30",
    "displayDate": "9/30/2024",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-27",
    "rowRef": 27,
    "date": "2024-10-01",
    "displayDate": "10/1/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-28",
    "rowRef": 28,
    "date": "2024-10-20",
    "displayDate": "10/20/2024",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-29",
    "rowRef": 29,
    "date": "2024-10-28",
    "displayDate": "10/28/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 6000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-30",
    "rowRef": 30,
    "date": "2024-12-01",
    "displayDate": "12/1/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 2000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-31",
    "rowRef": 31,
    "date": "2024-12-12",
    "displayDate": "12/12/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 3000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-32",
    "rowRef": 32,
    "date": "2024-12-28",
    "displayDate": "12/28/2024",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 1000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-33",
    "rowRef": 33,
    "date": "2024-12-28",
    "displayDate": "12/28/2024",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 6000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-34",
    "rowRef": 34,
    "date": "2025-01-02",
    "displayDate": "1/2/2025",
    "description": "Losartan",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -150.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Losartan"
  },
  {
    "id": "row-35",
    "rowRef": 35,
    "date": "2025-01-09",
    "displayDate": "1/9/2025",
    "description": "withdraw from Trusfund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": 48000.0,
    "bpiMoneyMarket": -48000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Withdrawn from trust fund into Cash on Hand"
  },
  {
    "id": "row-36",
    "rowRef": 36,
    "date": "2025-01-09",
    "displayDate": "1/9/2025",
    "description": "Hiram ni Dondon",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Dondon",
    "amountOnHand": -50000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Emergency family loan / disbursement for Dondon"
  },
  {
    "id": "row-37",
    "rowRef": 37,
    "date": "2025-01-20",
    "displayDate": "1/20/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-38",
    "rowRef": 38,
    "date": "2025-01-28",
    "displayDate": "1/28/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 3000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-39",
    "rowRef": 39,
    "date": "2025-02-23",
    "displayDate": "2/23/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-40",
    "rowRef": 40,
    "date": "2025-03-23",
    "displayDate": "3/23/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-41",
    "rowRef": 41,
    "date": "2025-03-24",
    "displayDate": "3/24/2025",
    "description": "Invest to trust fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -2000.0,
    "bpiMoneyMarket": 2000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-42",
    "rowRef": 42,
    "date": "2025-04-29",
    "displayDate": "4/29/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-43",
    "rowRef": 43,
    "date": "2025-05-19",
    "displayDate": "5/19/25",
    "description": "Dondon's partial payment",
    "category": "Reimbursement",
    "memberOrBeneficiary": "Dondon",
    "amountOnHand": 30000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Dondon's partial repayment to family fund"
  },
  {
    "id": "row-44",
    "rowRef": 44,
    "date": "2025-05-28",
    "displayDate": "5/28/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 6000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-45",
    "rowRef": 45,
    "date": "2025-05-20",
    "displayDate": "5/20/2025",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-46",
    "rowRef": 46,
    "date": "2025-05-20",
    "displayDate": "5/20/2025",
    "description": "Papa medecine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa medecine"
  },
  {
    "id": "row-47",
    "rowRef": 47,
    "date": "2025-06-09",
    "displayDate": "6/9/2025",
    "description": "Invest to trustfund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -16000.0,
    "bpiMoneyMarket": 16000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-48",
    "rowRef": 48,
    "date": "2025-06-19",
    "displayDate": "6/19/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-49",
    "rowRef": 49,
    "date": "2025-06-23",
    "displayDate": "6/23/2025",
    "description": "Pacheckup at gamot ni Mama sa almoranas",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Mama",
    "amountOnHand": -5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Pacheckup at gamot ni Mama sa almoranas"
  },
  {
    "id": "row-50",
    "rowRef": 50,
    "date": "2025-06-28",
    "displayDate": "6/28/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 6000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-51",
    "rowRef": 51,
    "date": "2025-06-28",
    "displayDate": "6/28/2025",
    "description": "Invest",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -22000.0,
    "bpiMoneyMarket": 22000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-52",
    "rowRef": 52,
    "date": "2025-07-17",
    "displayDate": "7/17/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-53",
    "rowRef": 53,
    "date": "2025-07-29",
    "displayDate": "7/29/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 6000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-54",
    "rowRef": 54,
    "date": "2025-07-31",
    "displayDate": "7/31/2025",
    "description": "Papa emergency",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa emergency"
  },
  {
    "id": "row-55",
    "rowRef": 55,
    "date": "2025-07-31",
    "displayDate": "7/31/2025",
    "description": "Citi scan",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Parents",
    "amountOnHand": -5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Citi scan"
  },
  {
    "id": "row-56",
    "rowRef": 56,
    "date": "2025-08-01",
    "displayDate": "8/1/2025",
    "description": "Day to day needs at the hospital",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Parents",
    "amountOnHand": -4000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Day to day needs at the hospital"
  },
  {
    "id": "row-57",
    "rowRef": 57,
    "date": "2025-08-01",
    "displayDate": "8/1/2025",
    "description": "Withdraw from trust fund",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": 40000.0,
    "bpiMoneyMarket": -40000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Withdrawn from trust fund into Cash on Hand"
  },
  {
    "id": "row-58",
    "rowRef": 58,
    "date": "2025-08-04",
    "displayDate": "8/4/2025",
    "description": "Papa Medecine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -600.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa Medecine"
  },
  {
    "id": "row-59",
    "rowRef": 59,
    "date": "2025-08-04",
    "displayDate": "8/4/2025",
    "description": "Hospital bill",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Parents",
    "amountOnHand": -23000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Hospital bill"
  },
  {
    "id": "row-60",
    "rowRef": 60,
    "date": "2025-08-15",
    "displayDate": "8/15/2025",
    "description": "Papa followup checkup and medecine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa followup checkup and medecine"
  },
  {
    "id": "row-61",
    "rowRef": 61,
    "date": "2025-08-26",
    "displayDate": "8/26/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-62",
    "rowRef": 62,
    "date": "2025-08-29",
    "displayDate": "8/29/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-63",
    "rowRef": 63,
    "date": "2025-09-02",
    "displayDate": "9/2/2025",
    "description": "Papa Medecine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa Medecine"
  },
  {
    "id": "row-64",
    "rowRef": 64,
    "date": "2025-09-18",
    "displayDate": "9/18/2025",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-65",
    "rowRef": 65,
    "date": "2025-09-30",
    "displayDate": "9/30/2025",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-66",
    "rowRef": 66,
    "date": "2025-10-09",
    "displayDate": "10/09/25",
    "description": "Papa medicine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa medicine"
  },
  {
    "id": "row-67",
    "rowRef": 67,
    "date": "2025-10-09",
    "displayDate": "10/09/25",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 1500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-68",
    "rowRef": 68,
    "date": "2025-10-18",
    "displayDate": "10/18/25",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-69",
    "rowRef": 69,
    "date": "2025-10-28",
    "displayDate": "10/28/25",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-70",
    "rowRef": 70,
    "date": "2025-11-24",
    "displayDate": "11/24/25",
    "description": "Papa laboratory",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -4000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa laboratory"
  },
  {
    "id": "row-71",
    "rowRef": 71,
    "date": "2025-11-26",
    "displayDate": "11/26/25",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-72",
    "rowRef": 72,
    "date": "2025-11-27",
    "displayDate": "11/27/25",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-73",
    "rowRef": 73,
    "date": "2025-11-30",
    "displayDate": "11/30/25",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-74",
    "rowRef": 74,
    "date": "2025-12-10",
    "displayDate": "12/10/2025",
    "description": "Gamot at pa check up ni papa sa derma",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot at pa check up ni papa sa derma"
  },
  {
    "id": "row-75",
    "rowRef": 75,
    "date": "2025-12-20",
    "displayDate": "12/20/25",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 2000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-76",
    "rowRef": 76,
    "date": "2025-12-28",
    "displayDate": "12/28/25",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-77",
    "rowRef": 77,
    "date": "2025-12-29",
    "displayDate": "12/29/25",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2780.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-78",
    "rowRef": 78,
    "date": "2026-01-17",
    "displayDate": "1/17/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-79",
    "rowRef": 79,
    "date": "2026-01-17",
    "displayDate": "1/17/26",
    "description": "Joel",
    "category": "Contribution",
    "memberOrBeneficiary": "Joel",
    "amountOnHand": 2000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Family contribution from Joel"
  },
  {
    "id": "row-80",
    "rowRef": 80,
    "date": "2026-01-28",
    "displayDate": "1/28/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-81",
    "rowRef": 81,
    "date": "2026-01-29",
    "displayDate": "1/29/2026",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2780.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-82",
    "rowRef": 82,
    "date": "2026-02-20",
    "displayDate": "2/20/2026",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-83",
    "rowRef": 83,
    "date": "2026-02-28",
    "displayDate": "2/28/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-84",
    "rowRef": 84,
    "date": "2026-03-06",
    "displayDate": "3/6/26",
    "description": "Papa laborator/check up",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa laborator/check up"
  },
  {
    "id": "row-85",
    "rowRef": 85,
    "date": "2026-03-20",
    "displayDate": "3/20/26",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -4160.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-86",
    "rowRef": 86,
    "date": "2026-03-20",
    "displayDate": "3/20/26",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-87",
    "rowRef": 87,
    "date": "2026-03-28",
    "displayDate": "3/28/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-88",
    "rowRef": 88,
    "date": "2026-04-01",
    "displayDate": "4/1/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-89",
    "rowRef": 89,
    "date": "2026-04-07",
    "displayDate": "4/7/26",
    "description": "Iloy",
    "category": "Contribution",
    "memberOrBeneficiary": "Iloy",
    "amountOnHand": 500.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Family contribution from Iloy"
  },
  {
    "id": "row-90",
    "rowRef": 90,
    "date": "2026-04-09",
    "displayDate": "4/9/26",
    "description": "Dondon's partial payment",
    "category": "Reimbursement",
    "memberOrBeneficiary": "Dondon",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": 11800.0,
    "highlightAlert": false,
    "notes": "Dondon's partial repayment to family fund"
  },
  {
    "id": "row-91",
    "rowRef": 91,
    "date": "2026-04-18",
    "displayDate": "4/18/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-92",
    "rowRef": 92,
    "date": "2026-04-21",
    "displayDate": "4/21/26",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2600.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-93",
    "rowRef": 93,
    "date": "2026-04-27",
    "displayDate": "4/27/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-94",
    "rowRef": 94,
    "date": "2026-05-25",
    "displayDate": "5/25/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-95",
    "rowRef": 95,
    "date": "2026-05-25",
    "displayDate": "5/25/26",
    "description": "Jonathan",
    "category": "Contribution",
    "memberOrBeneficiary": "Jonathan",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Jonathan"
  },
  {
    "id": "row-96",
    "rowRef": 96,
    "date": "2026-05-26",
    "displayDate": "5/26/26",
    "description": "Gamot ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2780.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot ni papa"
  },
  {
    "id": "row-97",
    "rowRef": 97,
    "date": "2026-05-27",
    "displayDate": "5/27/2026",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-98",
    "rowRef": 98,
    "date": "2026-06-17",
    "displayDate": "6/17/2026",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-99",
    "rowRef": 99,
    "date": "2026-06-30",
    "displayDate": "6/30/2026",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-100",
    "rowRef": 100,
    "date": "2026-06-30",
    "displayDate": "6/30/2026",
    "description": "Transfer",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": 0.0,
    "bpiMoneyMarket": 5000.0,
    "bpiShortTerm": -5000.0,
    "highlightAlert": false,
    "notes": "Reallocated between BPI investment funds"
  },
  {
    "id": "row-101",
    "rowRef": 101,
    "date": "2026-07-09",
    "displayDate": "7/9/2026",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-102",
    "rowRef": 102,
    "date": "2026-08-09",
    "displayDate": "8/9/26",
    "description": "Gamot at check up ni papa",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -2800.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Gamot at check up ni papa"
  },
  {
    "id": "row-103",
    "rowRef": 103,
    "date": "2026-08-11",
    "displayDate": "8/11/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-104",
    "rowRef": 104,
    "date": "2026-08-25",
    "displayDate": "8/25/26",
    "description": "invest",
    "category": "Internal Transfer",
    "memberOrBeneficiary": "BPI Funds",
    "amountOnHand": -40000.0,
    "bpiMoneyMarket": 40000.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Placement into BPI investment fund"
  },
  {
    "id": "row-105",
    "rowRef": 105,
    "date": "2026-08-31",
    "displayDate": "8/31/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-106",
    "rowRef": 106,
    "date": "2026-08-31",
    "displayDate": "8/31/26",
    "description": "Laura",
    "category": "Contribution",
    "memberOrBeneficiary": "Laura",
    "amountOnHand": 1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Laura"
  },
  {
    "id": "row-107",
    "rowRef": 107,
    "date": "2026-09-30",
    "displayDate": "9/30/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 5000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  },
  {
    "id": "row-108",
    "rowRef": 108,
    "date": "2026-09-30",
    "displayDate": "9/30/26",
    "description": "Papa checkup/xray",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -1000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa checkup/xray"
  },
  {
    "id": "row-109",
    "rowRef": 109,
    "date": "2026-10-14",
    "displayDate": "10/14/26",
    "description": "dondon's payment",
    "category": "Reimbursement",
    "memberOrBeneficiary": "Dondon",
    "amountOnHand": 3200.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Dondon's partial repayment to family fund"
  },
  {
    "id": "row-110",
    "rowRef": 110,
    "date": "2026-10-14",
    "displayDate": "10/14/26",
    "description": "Papa emergency checkup/medicine",
    "category": "Medical Disbursement",
    "memberOrBeneficiary": "Papa",
    "amountOnHand": -3200.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": true,
    "notes": "Parent healthcare expense: Papa emergency checkup/medicine"
  },
  {
    "id": "row-111",
    "rowRef": 111,
    "date": "2026-10-26",
    "displayDate": "10/26/26",
    "description": "Nene",
    "category": "Contribution",
    "memberOrBeneficiary": "Nene",
    "amountOnHand": 3000.0,
    "bpiMoneyMarket": 0.0,
    "bpiShortTerm": 0.0,
    "highlightAlert": false,
    "notes": "Monthly contribution from Nene"
  }
] as EFundTransaction[]
};

export function formatPHP(amount: number, showZeroAsBlank = false): string {
  if (showZeroAsBlank && amount === 0) {
    return '—';
  }
  const absFormatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(amount));
  if (amount < 0) {
    return `-₱${absFormatted}`;
  }
  return `₱${absFormatted}`;
}

export function calculateTotals(db: ClanEFundDatabase) {
  const baseOnHand = db.priorBalanceForward.included ? db.priorBalanceForward.amountOnHand : 0;
  const baseMMF = db.priorBalanceForward.included ? db.priorBalanceForward.bpiMoneyMarket : 0;
  const baseShortTerm = db.priorBalanceForward.included ? db.priorBalanceForward.bpiShortTerm : 0;

  let txOnHand = 0;
  let txMMF = 0;
  let txShortTerm = 0;
  let txMemberLoan = 0;

  for (const tx of db.transactions) {
    txOnHand += tx.amountOnHand;
    txMMF += tx.bpiMoneyMarket;
    txShortTerm += tx.bpiShortTerm;
    txMemberLoan += tx.memberLoan || 0;
  }

  const amountOnHand = Number((baseOnHand + txOnHand).toFixed(2));
  const bpiMoneyMarket = Number((baseMMF + txMMF).toFixed(2));
  const bpiShortTerm = Number((baseShortTerm + txShortTerm).toFixed(2));
  const memberLoan = Number(txMemberLoan.toFixed(2));
  const totalFund = Number((amountOnHand + bpiMoneyMarket + bpiShortTerm + memberLoan).toFixed(2));

  return {
    amountOnHand,
    bpiMoneyMarket,
    bpiShortTerm,
    memberLoan,
    totalFund,
    visibleDelta: {
      amountOnHand: Number(txOnHand.toFixed(2)),
      bpiMoneyMarket: Number(txMMF.toFixed(2)),
      bpiShortTerm: Number(txShortTerm.toFixed(2)),
      memberLoan: Number(txMemberLoan.toFixed(2))
    }
  };
}

export function calculateMamasTotals(state: MamasSavingsState): MamasSavingsState {
  let investSum = 0;
  let mamaAtmSum = 0;

  for (const rec of state.records) {
    investSum += rec.invest || 0;
    mamaAtmSum += rec.mamaAtm || 0;
  }

  const investBalance = Number(investSum.toFixed(2));
  const mamaAtmBalance = Number(mamaAtmSum.toFixed(2));
  const loanToMhariz = Number((state.loanToMhariz || 0).toFixed(2));
  const totalSavings = Number((investBalance + mamaAtmBalance + loanToMhariz).toFixed(2));

  return {
    ...state,
    investBalance,
    mamaAtmBalance,
    loanToMhariz,
    totalSavings
  };
}

