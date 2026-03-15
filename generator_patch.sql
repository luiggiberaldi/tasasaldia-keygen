-- =============================================
-- SQL PATCH: Fix Generator View
-- =============================================
-- Permite insertar licencias generadas manualmente desde la Estación Maestra.

CREATE OR REPLACE FUNCTION public.admin_generate_license_secure(p_device_id text, p_product_id text, p_type text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertamos o actualizamos la licencia
  INSERT INTO public.licenses (device_id, product_id, type, code, expires_at, active)
  VALUES (p_device_id, p_product_id, p_type, p_code, p_expires_at, true)
  ON CONFLICT (device_id, product_id) DO UPDATE
  SET type = EXCLUDED.type,
      code = EXCLUDED.code,
      expires_at = EXCLUDED.expires_at,
      active = EXCLUDED.active;

  -- Si es un demo, también lo registramos en la tabla de demos
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
