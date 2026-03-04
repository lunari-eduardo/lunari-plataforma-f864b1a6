-- Admin can read ALL plans (including inactive)
CREATE POLICY "Admins can read all plans"
ON public.unified_plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update plans
CREATE POLICY "Admins can update unified_plans"
ON public.unified_plans
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));