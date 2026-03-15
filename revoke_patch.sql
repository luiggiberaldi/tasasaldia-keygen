-- =============================================
-- SQL PATCH: Revoke License Fix
-- =============================================
CREATE OR REPLACE FUNCTION public.revoke_license_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Downgrade license to 'registered' and NOT active
  UPDATE public.licenses
  SET 
    type = 'registered',
    active = false,
    code = null,
    expires_at = null
  WHERE device_id = p_device_id AND product_id = p_product_id;

  -- 2. Mark demo as spent (to prevent re-activation by the user)
  -- If there's no demo, insert one that is already expired
  INSERT INTO public.demos (device_id, product_id, expires_at, activated_at, app_version)
  VALUES (p_device_id, p_product_id, now() - interval '1 day', now() - interval '8 days', 'revoked')
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = now() - interval '1 day';

END;
$$;

-- IMPORTANT: Grant permission to anon role so Estacion Maestra can call it!
GRANT EXECUTE ON FUNCTION public.revoke_license_secure(text, text) TO anon;
