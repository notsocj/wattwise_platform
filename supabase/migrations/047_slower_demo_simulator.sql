-- Run the demo simulator every 15 seconds instead of 10.
--
-- On the Free plan's Nano compute the project ran out of its disk IO budget
-- and stalled (November 19, 2026). Every pg_cron run writes a row to
-- cron.job_run_details even when no demo unit is running, so this cuts the
-- simulator's runs by a third (8,640 to 5,760 a day).
--
-- 15 s, not slower: the app shows a unit as LIVE only while its newest reading
-- is under 20 s old (ACTIVE_READING_WINDOW_MS in lib/device-telemetry.ts), so
-- a running demo unit still never looks offline between readings. Gaps under
-- 1 minute stay live streaming in simulate_demo_units(), not a backfill.

SELECT cron.alter_job(jobid, schedule := '15 seconds')
FROM cron.job
WHERE jobname = 'simulate-demo-units';
