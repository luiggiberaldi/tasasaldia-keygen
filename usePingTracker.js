import { useEffect } from 'react';
import { supabase } from '../services/supabase'; // Ajusta la ruta a tu cliente supabase

/**
 * Este Hook debe colocarse en el componente principal (App.jsx) o en el Layout 
 * principal de tus aplicaciones (Precios al Día, Tasas al Día, Abasto, Comida Rápida).
 * 
 * Se encarga de hacer "Ping" a la Estación Maestra cada 15 minutos mientras la app esté abirta.
 */
export function usePingTracker(deviceId, productId, isDemo = false) {
  useEffect(() => {
    // Si no hay deviceId, no podemos hacer ping
    if (!deviceId || !productId) return;

    const makePing = async () => {
      try {
        await supabase.rpc('register_ping', {
          p_device_id: deviceId,
          p_product_id: productId,
          p_is_demo: isDemo
        });
      } catch (err) {
        // Fallo en ping silencioso, no hace falta alertar al usuario
        console.warn('Ping fallido:', err.message);
      }
    };

    // Hacer ping inmediatamente al abrir la app o iniciar sesión
    makePing();

    // Configurar el intervalo para que haga ping cada 15 minutos (900000 ms)
    const interval = setInterval(() => {
      makePing();
    }, 900000);

    return () => clearInterval(interval);
  }, [deviceId, productId, isDemo]);
}
