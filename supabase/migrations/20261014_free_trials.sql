-- Admin-granted free trials. A trial is subscription_status = 'trialing' with
-- an end date; access stops automatically once trial_ends_at has passed
-- (see hasActiveAccess in lib/subscription.ts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.trial_ends_at IS 'End of an admin-granted free trial (status trialing); NULL = no trial';
