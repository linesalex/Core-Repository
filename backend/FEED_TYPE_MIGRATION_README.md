# Feed Type Migration Instructions

## Overview
This migration standardizes the `feed_type` values in the `exchange_feeds` table to match the frontend dropdown values, eliminating the need for translation logic between frontend and backend.

## What This Migration Does

### Before Migration:
- Database stored lowercase/mixed values: `'equities'`, `'futures'`, `'treasuries'`, `'Forex'`, etc.
- Frontend showed: `'Equities'`, `'Futures'`, `'Fixed Income'`, `'FX'`, etc.
- Required translation logic in both directions

### After Migration:
- Database stores the same values as frontend: `'Equities'`, `'Futures'`, `'Fixed Income'`, `'FX'`, etc.
- No translation logic needed
- Consistent display in tables and dropdowns

## Migration Mapping
The following values will be updated:

| Old Database Value | New Database Value |
|-------------------|-------------------|
| `equities` | `Equities` |
| `futures` | `Futures` |
| `options` | `Options` |
| `treasuries` | `Fixed Income` |
| `Forex` | `FX` |
| `commodities` | `Commodities` |
| `indices` | `Indices` |
| `ETFs` | `ETFs` |
| `crypto` | `Alternative Data` |
| `mutual funds` | `Reference Data` |

## How to Run on Your Test Server

### Step 1: Copy the Migration Script
Copy the `feed_type_migration.js` file to your test server's backend directory.

### Step 2: Run the Migration
```bash
cd /path/to/your/backend
node feed_type_migration.js
```

### Step 3: Expected Output
If you have exchange feeds data:
```
🔄 Starting feed_type standardization migration...
📊 Checking current feed_type values...
Current feed_type values in database:
  - "equities": 2 records
  - "futures": 1 records
  - "Forex": 1 records

🔄 Starting migration...
✅ Updated 2 records from "equities" to "Equities"
✅ Updated 1 records from "futures" to "Futures"

🔄 Creating new table with updated constraints...
✅ New table created successfully
✅ Data copied to new table
✅ Table renamed successfully
✅ Update trigger recreated

🎉 Migration completed successfully!

📊 Final feed_type values in database:
  - "Equities": 2 records
  - "FX": 1 records
  - "Futures": 1 records

✅ Database connection closed
🎯 You can now run this same script on your test server!
```

If you don't have exchange feeds data yet:
```
🔄 Starting feed_type standardization migration...
📊 Checking current feed_type values...
ℹ️  exchange_feeds table does not exist yet. This migration is only needed if you have exchange feeds data.
🎯 Run this script after creating exchange feeds to standardize the feed_type values.
```

## Safety Features
- ✅ Uses database transactions (rollback on error)
- ✅ Checks if table exists before migration
- ✅ Preserves all existing data
- ✅ Updates constraints to match new values
- ✅ Recreates triggers after migration

## Files Modified
The migration also removes translation logic from these files:
- `backend/routes.js` - Exchange feed endpoints now use direct values
- `frontend/src/ExchangeDataManager.js` - Removed mapping function

## Verification
After running the migration, you can verify it worked by:
1. Creating a new exchange feed - dropdown should work properly
2. Editing an existing exchange feed - values should display correctly
3. Checking the table display - feed types should show properly capitalized

## Rollback
If you need to rollback (not recommended), you would need to:
1. Restore the old translation logic in the code
2. Manually update the database values back to lowercase
3. Update the CHECK constraints back to the old values

However, this migration is one-way and designed to be permanent since it improves consistency. 