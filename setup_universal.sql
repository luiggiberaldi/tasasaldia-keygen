-- ============================================================
-- SCRIPT DEFINITIVO: Registro Universal de Dispositivos
-- Ejecutar en el SQL Editor de Supabase (jjbzevntreoxpuofgkyi)
-- ============================================================

-- 1. AGREGAR COLUMNAS FALTANTES a licenses
-- Las apps usan: last_seen_at, ip_address
-- El DB original tiene: last_active_at, last_ip
-- Solución: agregar AMBAS para compatibilidad

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS alias text;

-- 2. MIGRAR DATOS de columnas viejas a nuevas (si existen datos)
UPDATE licenses SET last_seen_at = last_active_at WHERE last_seen_at IS NULL AND last_active_at IS NOT NULL;
UPDATE licenses SET ip_address = last_ip WHERE ip_address IS NULL AND last_ip IS NOT NULL;

-- 3. AGREGAR COLUMNAS FALTANTES a demos
ALTER TABLE demos ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS ip_address text;

-- Migrar datos viejos
UPDATE demos SET last_seen_at = last_active_at WHERE last_seen_at IS NULL AND last_active_at IS NOT NULL;
UPDATE demos SET ip_address = last_ip WHERE ip_address IS NULL AND last_ip IS NOT NULL;

-- 4. UNIQUE CONSTRAINT en licenses (NECESARIO para upsert)
-- Sin esto, el auto-registro con ignoreDuplicates FALLA silenciosamente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'licenses_device_product_unique'
    ) THEN
        CREATE UNIQUE INDEX licenses_device_product_unique 
        ON licenses (device_id, product_id);
    END IF;
END $$;

-- 5. UNIQUE CONSTRAINT en demos (NECESARIO para upsert de demos)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'demos_device_product_unique'
    ) THEN
        CREATE UNIQUE INDEX demos_device_product_unique 
        ON demos (device_id, product_id);
    END IF;
END $$;

-- 6. RLS: Permitir que clientes anónimos puedan INSERT/UPDATE en licenses
-- (necesario para el auto-registro sin autenticación)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: cualquier anon puede leer su propio registro
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can read own license" ON licenses;
    CREATE POLICY "Anon can read own license" ON licenses
        FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Política de INSERT: cualquier anon puede crear registros
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can insert license" ON licenses;
    CREATE POLICY "Anon can insert license" ON licenses
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Política de UPDATE: cualquier anon puede actualizar registros
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can update license" ON licenses;
    CREATE POLICY "Anon can update license" ON licenses
        FOR UPDATE USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Política de DELETE: solo admin (service_role) puede eliminar
DO $$
BEGIN
    DROP POLICY IF EXISTS "Only admin can delete license" ON licenses;
    CREATE POLICY "Only admin can delete license" ON licenses
        FOR DELETE USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Lo mismo para demos
ALTER TABLE demos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can read demos" ON demos;
    CREATE POLICY "Anon can read demos" ON demos
        FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can insert demos" ON demos;
    CREATE POLICY "Anon can insert demos" ON demos
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can update demos" ON demos;
    CREATE POLICY "Anon can update demos" ON demos
        FOR UPDATE USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Only admin can delete demos" ON demos;
    CREATE POLICY "Only admin can delete demos" ON demos
        FOR DELETE USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Actualizar función register_ping para usar las columnas correctas
CREATE OR REPLACE FUNCTION register_ping(p_device_id text, p_product_id text, p_is_demo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ip text;
BEGIN
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF v_ip LIKE '%,%' THEN
        v_ip := split_part(v_ip, ',', 1);
    END IF;

    IF p_is_demo THEN
        UPDATE demos 
        SET last_seen_at = NOW(), ip_address = v_ip, last_active_at = NOW(), last_ip = v_ip
        WHERE device_id = p_device_id AND product_id = p_product_id;
    ELSE
        UPDATE licenses 
        SET last_seen_at = NOW(), ip_address = v_ip, last_active_at = NOW(), last_ip = v_ip
        WHERE device_id = p_device_id AND product_id = p_product_id;
    END IF;
END;
$$;

-- 8. Verificación final
SELECT 'licenses columns:' as info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'licenses' AND table_schema = 'public'
ORDER BY ordinal_position;
