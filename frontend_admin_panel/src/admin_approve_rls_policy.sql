-- Apply ONLY if the admin approve UPDATE on public.profiles is blocked by RLS.
-- Requirement: add exactly ONE policy.

CREATE POLICY "admins can approve mechanics"
ON public.profiles
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.admins WHERE user_id = auth.uid()
));
