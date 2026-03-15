-- =============================================
-- FIX: revoke_license_secure ahora bloquea demos
-- =============================================
-- Al revocar, insertar un registro "gastado" en la tabla demos
-- para que la PWA no permita re-activar el demo.

CREATE OR REPLACE FUNCTION public.revoke_license_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Degradar licencia a registrado/inactivo
  UPDATE public.licenses
  SET 
    type = 'registered',
    active = false,
    code = 'REVOCADA',
    expires_at = null
  WHERE device_id = p_device_id AND product_id = p_product_id;

  -- 2. Insertar demo "gastado" para bloquear re-activacion
  -- Si ya existe un registro de demo, no hacer nada (ON CONFLICT)
  INSERT INTO public.demos (device_id, product_id, expires_at, activated_at)
  VALUES (
    p_device_id,
    p_product_id,
    now() - interval '1 second',  -- ya vencido
    now()
  )
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = now() - interval '1 second';  -- forzar vencimiento si ya existia
END;
$$;
