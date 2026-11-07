-- Rollback for supabase/migrations/20261108_narrow_public_read.sql:
-- restores the previous "Public read access" USING (true) policies.

DROP POLICY IF EXISTS "Public read of non-private memberships" ON public.program_organizations;
CREATE POLICY "Public read access" ON public.program_organizations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Navigator team read access" ON public.organization_technical_terms;
CREATE POLICY "Public read access" ON public.organization_technical_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Navigator team read access" ON public.organization_technical_layers;
CREATE POLICY "Public read access" ON public.organization_technical_layers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Navigator team read access" ON public.organization_technology_claims;
CREATE POLICY "Public read access" ON public.organization_technology_claims FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read of published rounds" ON public.funding_rounds;
CREATE POLICY "Public read access" ON public.funding_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read of published round investors" ON public.funding_round_investors;
CREATE POLICY "Public read access" ON public.funding_round_investors FOR SELECT USING (true);
