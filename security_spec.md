# Clan E-Fund Ledger — Security Specification (Admin-Only Management, View-Only Contributors)

## 1. Data Invariants
1. **Single Shared Ledger Identity (`/ledgers/clan-efund-main`)**: The shared clan ledger lives at `ledgerId == 'clan-efund-main'`.
2. **Admin-Only Mutation Gate (`isAdmin()`)**: Only the verified administrator (`request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == 'jrjacob2000@gmail.com'`, or a UID in `/admins/{uid}`) may create, update, or delete `/ledgers/clan-efund-main` or `/ledgers/clan-efund-main/transactions/{transactionId}`.
3. **Contributor View-Only Access**: Contributors can read (`get`) `/ledgers/clan-efund-main` and read (`get`, `list`) `/ledgers/clan-efund-main/transactions/{transactionId}` only when `resource.data.ledgerId == 'clan-efund-main'`. Contributors are strictly forbidden from creating, updating, or deleting any record.
4. **Master Gate Relational Sync**: A transaction in `/ledgers/{ledgerId}/transactions/{transactionId}` cannot be created, updated, or deleted unless the parent document `/ledgers/{ledgerId}` exists and its `ownerId == request.auth.uid`.
5. **Anti-Update-Gap & Schema Whitelisting**: Both `create` and `update` must pass `isValidLedgerConfig(incoming())` or `isValidTransaction(incoming())` with strict `hasAll` and `hasOnly` key checks, string `.size()` bounds, numeric range bounds, and `affectedKeys().hasOnly(...)` on updates.
6. **Temporal & Identity Immutability**: `createdAt == request.time` and `updatedAt == request.time` on creation; `createdAt == existing().createdAt`, `ownerId == existing().ownerId`, and `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Payloads
1. **Contributor Write Attempt**: Authenticated user `contributor@example.com` (`email_verified: true`) attempts to `create` or `update` a transaction in `/ledgers/clan-efund-main/transactions/row-112` -> `PERMISSION_DENIED`.
2. **Email Spoofing (Unverified Admin Email)**: Attacker with `email: 'jrjacob2000@gmail.com'` but `email_verified: false` attempts to `create` or `update` `/ledgers/clan-efund-main` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (`ownerId` Mismatch)**: Admin attempts to create `/ledgers/clan-efund-main` with `ownerId: 'different-uid'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Admin includes `"isSuperAdmin": true` in `/ledgers/clan-efund-main/transactions/row-93` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Update**: Admin updates `/ledgers/clan-efund-main` with an unauthorized key `"extraField": "hack"` -> `PERMISSION_DENIED`.
6. **Orphaned Subcollection Write**: Admin attempts to create `/ledgers/clan-efund-main/transactions/row-93` before `/ledgers/clan-efund-main` exists -> `PERMISSION_DENIED`.
7. **Immutable Field Tampering (`createdAt` / `ownerId`)**: Admin attempts to modify `createdAt` or `ownerId` during `update` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Admin supplies a past or future timestamp instead of `request.time` for `updatedAt` -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (Oversized String)**: Admin sends a 10,000-character string in `description` or `notes` -> `PERMISSION_DENIED`.
10. **Array Overflow Attack**: Admin sends 50 items in `members` (exceeding max 30) or non-string first element -> `PERMISSION_DENIED`.
11. **Invalid Enum Value**: Admin sets `category: "Crypto Speculation"` or `currency: "USD"` -> `PERMISSION_DENIED`.
12. **Unscoped List Query**: Client queries `/ledgers/clan-efund-main/transactions` without `where('ledgerId', '==', 'clan-efund-main')` -> `PERMISSION_DENIED`.
