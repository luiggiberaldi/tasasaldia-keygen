-- =============================================
-- SQL PATCH: Función Segura para Anular Demos
-- =============================================

CREATE OR REPLACE FUNCTION public.revoke_demo_secure(p_device_id text, p_product_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Forzar vencimiento inmediato en la tabla de demos
  UPDATE public.demos
  SET expires_at = now() - interval '1 second'
  WHERE device_id = p_device_id AND product_id = p_product_id;

  -- 2. Forzar vencimiento inmediato en la tabla de licenses
  -- Esto asegura que la PWA lo detecte como vencido inmediatamente
  UPDATE public.licenses
  SET 
    expires_at = now() - interval '1 second',
    active = false
  WHERE device_id = p_device_id AND product_id = p_product_id AND type = 'demo7';
END;
$$;
