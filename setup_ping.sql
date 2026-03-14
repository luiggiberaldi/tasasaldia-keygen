-- Ejecuta este script en el "SQL Editor" de tu proyecto de Supabase

-- 1. Añadimos las columnas a las tablas
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS last_ip text;

ALTER TABLE demos ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS last_ip text;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;

-- 2. Creamos la función para que los clientes hagan Ping directo a la DB
CREATE OR REPLACE FUNCTION register_ping(p_device_id text, p_product_id text, p_is_demo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Nos permite evadir RLS si fuera necesario para que el cliente pueda actualizar su estado sin autenticarse (ya confiamos en el device_id)
AS $$
DECLARE
    v_ip text;
BEGIN
    -- Obtenemos la IP real del cliente que se guarda en el Header de PostgREST
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    
    -- Limpieza por si hay proxy
    IF v_ip LIKE '%,%' THEN
        v_ip := split_part(v_ip, ',', 1);
    END IF;

    IF p_is_demo THEN
        UPDATE demos 
        SET last_active_at = NOW(), last_ip = v_ip 
        WHERE device_id = p_device_id AND product_id = p_product_id;
    ELSE
        UPDATE licenses 
        SET last_active_at = NOW(), last_ip = v_ip
        WHERE device_id = p_device_id AND product_id = p_product_id;
    END IF;
END;
$$;
