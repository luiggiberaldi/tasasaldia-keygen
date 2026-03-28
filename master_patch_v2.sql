-- =============================================
-- MASTER PATCH V2: License System Overhaul
-- =============================================
-- Unifica todo el sistema de licencias en la tabla 'licenses'
-- Tipos: registered, demo7, permanent, revoked
-- Revocación = marcar como revoked, NUNCA borrar

-- 1. REVOCAR LICENCIA (NO DELETE, marca como revoked)
CREATE OR REPLACE FUNCTION public.admin_revoke_license_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET 
    type = 'revoked',
    active = false,
    code = 'REVOKED',
    expires_at = null
  WHERE device_id = p_device_id AND product_id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_license_secure(text, text) TO anon;


-- 2. ACTIVAR DEMO (funciona desde cualquier estado)
CREATE OR REPLACE FUNCTION public.admin_activate_demo_secure(p_device_id text, p_product_id text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET 
    type = 'demo7',
    active = true,
    code = p_code,
    expires_at = p_expires_at
  WHERE device_id = p_device_id AND product_id = p_product_id;

  -- Upsert en tabla demos
  INSERT INTO public.demos (device_id, product_id, expires_at, activated_at, app_version)
  VALUES (p_device_id, p_product_id, p_expires_at, now(), 'admin')
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        activated_at = EXCLUDED.activated_at,
        app_version = EXCLUDED.app_version;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_activate_demo_secure(text, text, text, timestamptz) TO anon;


-- 3. HACER PERMANENTE (funciona desde cualquier estado)
CREATE OR REPLACE FUNCTION public.admin_make_permanent_secure(p_device_id text, p_product_id text, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET 
    type = 'permanent',
    active = true,
    code = p_code,
    expires_at = null
  WHERE device_id = p_device_id AND product_id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_make_permanent_secure(text, text, text) TO anon;


-- 4. GENERAR LICENCIA (mantener para el GeneratorView)
CREATE OR REPLACE FUNCTION public.admin_generate_license_secure(p_device_id text, p_product_id text, p_type text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.licenses (device_id, product_id, type, code, expires_at, active)
  VALUES (p_device_id, p_product_id, p_type, p_code, p_expires_at, true)
  ON CONFLICT (device_id, product_id) DO UPDATE
  SET type = EXCLUDED.type,
      code = EXCLUDED.code,
      expires_at = EXCLUDED.expires_at,
      active = true;

  IF p_type = 'demo7' THEN
    INSERT INTO public.demos (device_id, product_id, expires_at, activated_at, app_version)
    VALUES (p_device_id, p_product_id, p_expires_at, now(), 'admin_gen')
    ON CONFLICT (device_id, product_id) DO UPDATE
      SET expires_at = EXCLUDED.expires_at, 
          activated_at = EXCLUDED.activated_at, 
          app_version = EXCLUDED.app_version;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_generate_license_secure(text, text, text, text, timestamptz) TO anon;


-- 5. RESETEAR A SIN LICENCIA (volver a registered)
CREATE OR REPLACE FUNCTION public.admin_reset_to_registered_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET 
    type = 'registered',
    active = false,
    code = 'AUTO-REGISTRO',
    expires_at = null
  WHERE device_id = p_device_id AND product_id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reset_to_registered_secure(text, text) TO anon;
