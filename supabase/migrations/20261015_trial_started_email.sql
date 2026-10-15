-- Marker for the "trial started" email so a failed send is retried by the
-- daily job (lib/trial-emails.ts). Cleared whenever an admin starts or extends
-- a trial. Existing trials already received their email, so mark them sent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_email_sent_at TIMESTAMPTZ;

UPDATE profiles
SET trial_started_email_sent_at = NOW()
WHERE subscription_status = 'trialing'
  AND trial_started_email_sent_at IS NULL;
