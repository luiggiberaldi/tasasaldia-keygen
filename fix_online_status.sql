-- =============================================
-- FIX: Trigger NO debe contaminar last_seen_at
-- =============================================
-- El trigger sync_demo_to_license estaba reseteando last_seen_at = now()
-- cada vez que se tocaba la tabla demos (incluso por sistema).
-- Esto causaba que todos los demos aparecieran como "En línea" falsamente.
-- Solo el heartbeat_device RPC debe actualizar last_seen_at.

CREATE OR REPLACE FUNCTION public.sync_demo_to_license()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.licenses (
    device_id, product_id, type, active, expires_at,
    code, client_name, notes
  )
  VALUES (
    NEW.device_id,
    NEW.product_id,
    'demo7',
    true,
    NEW.expires_at,
    'DEMO-AUTO-' || to_char(COALESCE(NEW.activated_at, now()), 'YYYYMMDD'),
    'Demo User (' || NEW.device_id || ')',
    'Auto-sincronizado desde tabla demos'
  )
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        type = EXCLUDED.type,
        active = true;
  RETURN NEW;
END;
$$;

-- FIX: activate_demo_secure no debe setear last_seen_at
-- Solo activated_at es correcto al crear un demo.
CREATE OR REPLACE FUNCTION public.activate_demo_secure(
  p_device_id text,
  p_product_id text
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.demos 
    WHERE device_id = p_device_id AND product_id = p_product_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.demos (device_id, product_id, expires_at, activated_at)
    VALUES (
      p_device_id, 
      p_product_id, 
      now() + interval '7 days', 
      now()
    );
  END IF;
END;
$$;

-- FIX: Limpiar timestamps contaminados en demos
-- Resetear last_seen_at a NULL para demos que nunca enviaron un heartbeat real
UPDATE public.demos SET last_seen_at = NULL
WHERE last_seen_at IS NOT NULL
  AND device_id IN ('TASAS-F6BAE3BD', 'TASAS-V2-SUCCESS', 'PDA-700564BC');
