-- The legacy admin device policy queried profiles while evaluating every
-- device SELECT, which caused recursion for anonymous ESP32 reads. The
-- multi-tenant policies and hardware anon policy now cover this table.

DROP POLICY IF EXISTS "super_admin_select_devices" ON devices;
