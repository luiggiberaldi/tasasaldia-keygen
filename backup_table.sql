-- ============================================================
-- SCRIPT: Creación de tabla para Backups Remotos de las Bodegas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Crear la tabla de backups
CREATE TABLE IF NOT EXISTS device_backups (
    device_id text PRIMARY KEY,
    product_id text NOT NULL,
    backup_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar la seguridad a nivel de filas (RLS)
ALTER TABLE device_backups ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para que cualquier bodega anónima pueda subir su backup
-- Upsert usa UPDATE/INSERT por lo que necesitamos ambas
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can insert backup" ON device_backups;
    CREATE POLICY "Anon can insert backup" ON device_backups
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can update backup" ON device_backups;
    CREATE POLICY "Anon can update backup" ON device_backups
        FOR UPDATE USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Crear política para leer los backups (Estación Maestra/Bodegas)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon can read backups" ON device_backups;
    CREATE POLICY "Anon can read backups" ON device_backups
        FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Crear índice para búsquedas por producto (si alguna vez se requiere)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'device_backups_product_id_idx'
    ) THEN
        CREATE INDEX device_backups_product_id_idx 
        ON device_backups (product_id);
    END IF;
END $$;
