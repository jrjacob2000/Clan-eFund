import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';

describe('Clan E-Fund Ledger Firestore Security Rules (Admin vs View-Only Contributor)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'clan-efund-ledger-rbac-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const adminAuth = {
    uid: 'admin_uid_1',
    email: 'jrjacob2000@gmail.com',
    email_verified: true
  };

  const contributorAuth = {
    uid: 'contributor_uid_2',
    email: 'nene.contributor@example.com',
    email_verified: true
  };

  const baseLedger = {
    ownerId: 'admin_uid_1',
    clanName: 'Clan Emergency Fund (E-Fund)',
    currency: 'PHP',
    cashReserveTarget: 15000,
    priorIncluded: true,
    priorLabel: 'Cumulative Balance Forward (Rows 4–92)',
    priorDate: '2026-04-26',
    priorAmountOnHand: 30550,
    priorBpiMoneyMarket: 23000,
    priorBpiShortTerm: 11800,
    members: ['Nene', 'Laura', 'Jonathan', 'Dondon']
  };

  const baseTx = {
    ledgerId: 'clan-efund-main',
    ownerId: 'admin_uid_1',
    rowRef: 93,
    date: '2026-04-27',
    displayDate: '4/27/2026',
    description: 'Nene',
    category: 'Contribution',
    memberOrBeneficiary: 'Nene',
    amountOnHand: 5000,
    bpiMoneyMarket: 0,
    bpiShortTerm: 0,
    highlightAlert: false,
    notes: 'April contribution'
  };

  test('1. Contributor cannot create or modify the ledger or transactions', async () => {
    const contribDb = testEnv.authenticatedContext(contributorAuth.uid, contributorAuth).firestore();
    await assertFails(
      setDoc(doc(contribDb, 'ledgers', 'clan-efund-main'), {
        ...baseLedger,
        ownerId: contributorAuth.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('2. Spoofed admin email with email_verified: false is rejected', async () => {
    const spoofDb = testEnv
      .authenticatedContext('admin_uid_1', {
        email: 'jrjacob2000@gmail.com',
        email_verified: false
      })
      .firestore();
    await assertFails(
      setDoc(doc(spoofDb, 'ledgers', 'clan-efund-main'), {
        ...baseLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('3. Verified admin (jrjacob2000@gmail.com) can create ledger and transactions, while contributor can only view', async () => {
    const adminDb = testEnv.authenticatedContext(adminAuth.uid, adminAuth).firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, 'ledgers', 'clan-efund-main'), {
        ...baseLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
    await assertSucceeds(
      setDoc(doc(adminDb, 'ledgers', 'clan-efund-main', 'transactions', 'row-93'), {
        ...baseTx,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );

    const contribDb = testEnv.authenticatedContext(contributorAuth.uid, contributorAuth).firestore();
    await assertSucceeds(getDoc(doc(contribDb, 'ledgers', 'clan-efund-main')));
    await assertSucceeds(
      getDoc(doc(contribDb, 'ledgers', 'clan-efund-main', 'transactions', 'row-93'))
    );
    await assertFails(
      updateDoc(doc(contribDb, 'ledgers', 'clan-efund-main', 'transactions', 'row-93'), {
        amountOnHand: 999999,
        updatedAt: serverTimestamp()
      })
    );
    await assertFails(
      deleteDoc(doc(contribDb, 'ledgers', 'clan-efund-main', 'transactions', 'row-93'))
    );
  });
});
