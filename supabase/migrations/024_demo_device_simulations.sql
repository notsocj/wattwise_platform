CREATE TABLE IF NOT EXISTS public.demo_device_simulations (
  device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  simulated_watts numeric(10,2) NOT NULL DEFAULT 100 CHECK (simulated_watts >= 0 AND simulated_watts <= 5000),
  simulated_voltage_v numeric(10,2) NOT NULL DEFAULT 230 CHECK (simulated_voltage_v >= 180 AND simulated_voltage_v <= 260),
  energy_kwh numeric(12,4) NOT NULL DEFAULT 0,
  last_generated_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_device_simulations_active ON public.demo_device_simulations(is_active);
ALTER TABLE public.demo_device_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_select_demo_device_simulations ON public.demo_device_simulations;
CREATE POLICY super_admin_select_demo_device_simulations ON public.demo_device_simulations
  FOR SELECT TO authenticated USING (current_profile_role() = 'super_admin');
