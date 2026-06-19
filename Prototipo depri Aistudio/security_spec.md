# Security Specification - Bar Management App

## Data Invariants
1. **Ownership**: Every document (StockItem, SaleTransaction, CustomerProfile, Provider, EventModel) MUST belong to an authenticated user (`ownerId`).
2. **Integrity**: 
    - Prices and quantities must be non-negative numbers.
    - Dates must follow ISO 8601 format (stored as strings).
    - Required fields (name, category, etc.) must never be empty.
3. **Immutability**: `createdAt` and `ownerId` fields must never change after creation.
4. **Validation**: All document IDs must match `^[a-zA-Z0-9_\-]+$`.

## The "Dirty Dozen" Payloads (Red Team Tests)
1. **Unauthorized Create**: Create a stock item while `request.auth` is null.
2. **Identity Spoofing**: Create a document where `ownerId` is set to a UID other than the current user's.
3. **Price Poisoning**: Update `selling_price` to a negative value or a non-numeric string.
4. **Update-Gap / Ghost Fields**: Update a document with an unwhitelisted field `isAdmin: true`.
5. **Ownership Theft**: Update a document belonging to User A while authenticated as User B.
6. **Immutable Field Write**: Attempt to change the `ownerId` of an existing document.
7. **Resource Exhaustion**: Send a `name` string that is 1MB in size.
8. **Invalid ID Poisoning**: Create a document with an ID containing special characters like `../root`.
9. **State Shortcut**: (N/A for this app, but could apply to event status transitions).
10. **Orphaned Write**: Create a sale referencing a non-existent stock item (handled by app logic, rules check for `exists()` where possible).
11. **Type Mismatch**: Send a list `items` where one element is a string instead of an object.
12. **Blanket List Leak**: Attempt to list all documents in a collection without a `where("ownerId", "==", uid)` filter.

## Test Runner (Draft)
A `firestore.rules.test.ts` will verify these payloads return `PERMISSION_DENIED`.
