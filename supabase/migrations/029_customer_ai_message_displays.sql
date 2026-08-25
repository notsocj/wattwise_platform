-- Persist safe, server-generated rich displays so device cards survive reloads.
ALTER TABLE public.customer_ai_messages
  ADD COLUMN IF NOT EXISTS display_data jsonb;

ALTER TABLE public.customer_ai_messages
  DROP CONSTRAINT IF EXISTS customer_ai_display_data_check;
ALTER TABLE public.customer_ai_messages
  ADD CONSTRAINT customer_ai_display_data_check CHECK (
    display_data IS NULL
    OR (
      jsonb_typeof(display_data) = 'object'
      AND display_data->>'type' = 'device_list'
      AND jsonb_typeof(display_data->'devices') = 'array'
      AND jsonb_array_length(display_data->'devices') BETWEEN 1 AND 8
    )
  );

