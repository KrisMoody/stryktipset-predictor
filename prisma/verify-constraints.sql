-- Verification script for match_odds constraints
-- Run this to verify that the unique constraint is correctly configured

-- Check all constraints on match_odds table
SELECT 
  tc.constraint_name, 
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as constraint_columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
WHERE tc.table_name = 'match_odds' 
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_name;

-- Expected result:
-- constraint_name: match_odds_match_id_source_type_collected_at_key
-- constraint_type: UNIQUE
-- constraint_columns: match_id, source, type, collected_at

-- Check all indexes on match_odds table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'match_odds'
ORDER BY indexname;

