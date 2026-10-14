-- One-time markers for the trial reminder and "trial ended" emails
-- (lib/trial-emails.ts). Cleared whenever an admin starts or extends a trial.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ended_email_sent_at TIMESTAMPTZ;
