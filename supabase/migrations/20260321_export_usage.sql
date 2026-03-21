-- Track monthly CSV export usage per user

CREATE TABLE export_usage (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  period      TEXT    NOT NULL,          -- "YYYY-MM"
  export_count INTEGER DEFAULT 0 NOT NULL,
  UNIQUE (user_id, period)
);

ALTER TABLE export_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own export_usage"
  ON export_usage FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_export_usage_user_period ON export_usage (user_id, period);

-- Atomic increment; returns new count
CREATE OR REPLACE FUNCTION increment_export_usage(p_user_id UUID, p_period TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO export_usage (user_id, period, export_count)
    VALUES (p_user_id, p_period, 1)
  ON CONFLICT (user_id, period)
    DO UPDATE SET export_count = export_usage.export_count + 1
  RETURNING export_count INTO new_count;
  RETURN new_count;
END;
$$;
