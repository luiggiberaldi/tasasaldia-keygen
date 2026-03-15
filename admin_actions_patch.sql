-- =============================================
-- SQL PATCH: Admin Actions for Registros
-- =============================================
-- Funciones para que la Estacion Maestra (con anon key) pueda 
-- ascender licencias limitadas a Demos o Premium.

-- 1. ACTIVAR DEMO DESDE LA ESTACION (DEMO INFINITO PARA ADMIN)
CREATE OR REPLACE FUNCTION public.admin_activate_demo_secure(p_device_id text, p_product_id text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar tipo a demo7, codigo temporal y nueva fecha
  UPDATE public.licenses
  SET 
    type = 'demo7',
    active = true,
    code = p_code,
    expires_at = p_expires_at
  WHERE device_id = p_device_id AND product_id = p_product_id;

  -- Upsert en la tabla demos: sobreescribe el estado de cualquier demo anterior
  -- Dandole asi 7 dias nuevos al dispositivo, incluso si ya estaba agotado.
  INSERT INTO public.demos (device_id, product_id, expires_at, activated_at, app_version)
  VALUES (p_device_id, p_product_id, p_expires_at, now(), 'admin')
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        activated_at = EXCLUDED.activated_at,
        app_version = EXCLUDED.app_version;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_activate_demo_secure(text, text, text, timestamptz) TO anon;


-- 2. HACER PERMANENTE DESDE LA ESTACION
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


-- 3. ELIMINAR REGISTRO
CREATE OR REPLACE FUNCTION public.admin_delete_record_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Borrar tanto la licencia como el registro del demo,
  -- permitiendo que el equipo arranque de cero si vuelve a abrir la app.
  DELETE FROM public.licenses
  WHERE device_id = p_device_id AND product_id = p_product_id;

  DELETE FROM public.demos
  WHERE device_id = p_device_id AND product_id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_record_secure(text, text) TO anon;
