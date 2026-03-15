-- =============================================
-- THE ULTIMATE SECURITY-HARDENED SQL SCRIPT
-- =============================================
-- Resuelve todos los problemas de UPSERT desde PWA 
-- y bloquea por completo la tabla "licenses" de inyecciones anónimas.

-- 1. BLOQUEAR POR COMPLETO "licenses" DE ESCRITURAS ANON (NO UPSERT / NO INSERT)
DROP POLICY IF EXISTS "Anon can insert license" ON licenses;
DROP POLICY IF EXISTS "Anon can update license" ON licenses;
DROP POLICY IF EXISTS "Anon can read own license" ON licenses;
DROP POLICY IF EXISTS "Only admin can delete license" ON licenses;
DROP POLICY IF EXISTS "anon select own license" ON licenses;
DROP POLICY IF EXISTS "anon insert auto-registro" ON licenses;
DROP POLICY IF EXISTS "anon update heartbeat only" ON licenses;
DROP POLICY IF EXISTS "anon insert licenses" ON licenses;
DROP POLICY IF EXISTS "anon update licenses" ON licenses;
DROP POLICY IF EXISTS "admin autenticado inserta licencias" ON licenses;
DROP POLICY IF EXISTS "admin autenticado gestiona licencias" ON licenses;

-- 1A. Select: Permits offline heartbeat verification y status check
CREATE POLICY "anon select own license" ON licenses
  FOR SELECT TO anon
  USING (true);

-- 1B. Admin (via Auth) Management
CREATE POLICY "admin autenticado inserta licencias" ON licenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'tasasaldiaoficial@gmail.com');

CREATE POLICY "admin autenticado gestiona licencias" ON licenses
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'tasasaldiaoficial@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'tasasaldiaoficial@gmail.com');

-- 2. BLOQUEAR POR COMPLETO "demos" DE ESCRITURAS ANON DIRECTAS
DROP POLICY IF EXISTS "Enable delete for anon on demos" ON demos;
DROP POLICY IF EXISTS "Only admin can delete demos" ON demos;
DROP POLICY IF EXISTS "demos_insert" ON demos;
DROP POLICY IF EXISTS "demos_read" ON demos;
DROP POLICY IF EXISTS "demos_update" ON demos;
DROP POLICY IF EXISTS "Anon can insert demos" ON demos;
DROP POLICY IF EXISTS "Anon can read demos" ON demos;
DROP POLICY IF EXISTS "Anon can update demos" ON demos;
DROP POLICY IF EXISTS "anon select demos" ON demos;
DROP POLICY IF EXISTS "anon insert demos" ON demos;
DROP POLICY IF EXISTS "anon update demos heartbeat" ON demos;

CREATE POLICY "anon select demos" ON demos
  FOR SELECT TO anon USING (true);


-- =============================================
-- SEGURIDAD DEFINER RPC: THE SAFEST WAY FOR PWA TO WRITE
-- =============================================
-- Function 1: Secure Auto-Registration
CREATE OR REPLACE FUNCTION public.auto_register_device(
  p_device_id text,
  p_product_id text,
  p_client_name text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.licenses (
    device_id, product_id, type, active, code, last_seen_at, client_name
  )
  VALUES (
    p_device_id, p_product_id, 'registered', false, 'AUTO-REGISTRO', now(), COALESCE(p_client_name, p_device_id)
  )
  ON CONFLICT (device_id, product_id) DO UPDATE
  SET 
    last_seen_at = now(),
    client_name = CASE 
      WHEN p_client_name IS NOT NULL AND p_client_name <> '' THEN p_client_name 
      ELSE licenses.client_name 
    END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_register_device(text, text, text) TO anon;

-- Function 2: Secure Heartbeat (replaces anon UPDATE policy)
CREATE OR REPLACE FUNCTION public.heartbeat_device(
  p_device_id text,
  p_product_id text,
  p_client_name text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We ONLY update last_seen_at and optionally client_name. Nothing else can be tampered with!
  UPDATE public.licenses 
  SET 
    last_seen_at = now(),
    client_name = CASE 
      WHEN p_client_name IS NOT NULL AND p_client_name <> '' THEN p_client_name 
      ELSE licenses.client_name 
    END
  WHERE device_id = p_device_id AND product_id = p_product_id;
  
  -- Update demo heartbeat as well to keep everything synced (if exists)
  UPDATE public.demos 
  SET last_seen_at = now() 
  WHERE device_id = p_device_id AND product_id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.heartbeat_device(text, text, text) TO anon;

-- Function 3: Secure Demo Activation
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
  -- Check if this device already had a demo
  SELECT EXISTS(
    SELECT 1 FROM public.demos 
    WHERE device_id = p_device_id AND product_id = p_product_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.demos (device_id, product_id, expires_at, activated_at, last_seen_at)
    VALUES (
      p_device_id, 
      p_product_id, 
      now() + interval '7 days', 
      now(), 
      now()
    );
    -- (The sync_demo_to_license trigger will automatically insert the demo into licenses)
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_demo_secure(text, text) TO anon;


-- =============================================
-- TRIGGER: SYNC DEMO TO LICENSE (SAFE MODE)
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_demo_to_license()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.licenses (
    device_id, product_id, type, active, expires_at,
    code, client_name, notes, last_seen_at
  )
  VALUES (
    NEW.device_id,
    NEW.product_id,
    'demo7',
    true,
    NEW.expires_at,
    'DEMO-AUTO-' || to_char(COALESCE(NEW.activated_at, now()), 'YYYYMMDD'),
    'Demo User (' || NEW.device_id || ')',
    'Auto-sincronizado desde tabla demos',
    now()
  )
  ON CONFLICT (device_id, product_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        type = EXCLUDED.type,
        active = true,
        last_seen_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_demo_to_license ON public.demos;
CREATE TRIGGER trigger_sync_demo_to_license
AFTER INSERT OR UPDATE ON public.demos
FOR EACH ROW
EXECUTE FUNCTION public.sync_demo_to_license();
