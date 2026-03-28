-- =============================================
-- PATCH: Fix Demo Heartbeat overwriting Permanent/Revoked Licenses
-- =============================================
-- The sync_demo_to_license trigger was firing on EVERY update to the 
-- `demos` table (like when the app sends a heartbeat `last_seen_at` update).
-- This overwrite the `licenses` table back to 'demo7', erasing 'permanent'
-- or 'revoked' statuses.
--
-- FIX: We modify the trigger function to only change `type` to 'demo7' 
-- if the current license is NOT 'permanent' or 'revoked', OR better yet,
-- only fire this logic during an INSERT on the demos table.

CREATE OR REPLACE FUNCTION public.sync_demo_to_license()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only force demo7 on initial creation of the demo
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
  END IF;
  
  RETURN NEW;
END;
$$;
