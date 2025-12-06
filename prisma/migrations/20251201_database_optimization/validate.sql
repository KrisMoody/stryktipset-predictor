-- Validation queries to verify database optimization migration

-- 1. Check that all reference tables have data
SELECT 
  'teams' as table_name,
  COUNT(*) as count
FROM teams
UNION ALL
SELECT 
  'countries' as table_name,
  COUNT(*) as count
FROM countries
UNION ALL
SELECT 
  'leagues' as table_name,
  COUNT(*) as count
FROM leagues;

-- 2. Verify all matches have valid foreign key references
SELECT 
  'Matches with invalid home_team_id' as check_name,
  COUNT(*) as count
FROM matches m
LEFT JOIN teams t ON m.home_team_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 
  'Matches with invalid away_team_id' as check_name,
  COUNT(*) as count
FROM matches m
LEFT JOIN teams t ON m.away_team_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 
  'Matches with invalid league_id' as check_name,
  COUNT(*) as count
FROM matches m
LEFT JOIN leagues l ON m.league_id = l.id
WHERE l.id IS NULL;

-- 3. Check that generated columns work correctly
SELECT 
  draw_number,
  draw_date,
  week_number,
  year,
  EXTRACT(WEEK FROM draw_date)::INTEGER as computed_week,
  EXTRACT(YEAR FROM draw_date)::INTEGER as computed_year
FROM draws
LIMIT 5;

-- 4. Verify indexes exist
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('matches', 'teams', 'leagues', 'countries', 'match_odds', 'predictions')
ORDER BY tablename, indexname;

-- 5. Test a complex query with joins
SELECT 
  m.id,
  ht.name as home_team,
  at.name as away_team,
  l.name as league,
  c.name as country,
  d.draw_number,
  COUNT(mo.id) as odds_count,
  COUNT(p.id) as predictions_count
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
JOIN leagues l ON m.league_id = l.id
LEFT JOIN countries c ON l.country_id = c.id
JOIN draws d ON m.draw_id = d.id
LEFT JOIN match_odds mo ON m.id = mo.match_id
LEFT JOIN predictions p ON m.id = p.match_id
GROUP BY m.id, ht.name, at.name, l.name, c.name, d.draw_number
ORDER BY d.draw_number DESC, m.match_number ASC
LIMIT 10;

-- 6. Check for any orphaned data
SELECT 
  'Orphaned leagues (no country)' as check_name,
  COUNT(*) as count
FROM leagues l
LEFT JOIN countries c ON l.country_id = c.id
WHERE c.id IS NULL AND l.country_id != 0

UNION ALL

SELECT 
  'Orphaned matches (no draw)' as check_name,
  COUNT(*) as count
FROM matches m
LEFT JOIN draws d ON m.draw_id = d.id
WHERE d.id IS NULL;

-- 7. Performance check: Explain a common query
EXPLAIN ANALYZE
SELECT 
  m.*,
  ht.name as home_team_name,
  at.name as away_team_name,
  l.name as league_name
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
JOIN leagues l ON m.league_id = l.id
WHERE m.home_team_id = 1 AND m.away_team_id = 2
LIMIT 10;

