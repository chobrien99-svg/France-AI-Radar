-- Track the one-time welcome email sent when a new account is first confirmed.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.welcome_email_sent_at IS 'When the welcome email was sent (lib/welcome-email.ts); NULL = not sent yet';

-- Existing confirmed accounts are not new: mark them so they never get a welcome email.
UPDATE profiles p
SET welcome_email_sent_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.welcome_email_sent_at IS NULL;
