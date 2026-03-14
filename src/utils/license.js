export async function hashDeviceId(devId, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(devId + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  
  return `ACTIV-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export const PRODUCTS = {
  tasas: {
    name: 'Tasas al Día',
    shortName: 'TASAS',
    prefix: 'TASAS-',
    salt: 'TASAS_ALDIA_2024_SECURE_SALT_V1',
    color: '#fcd535',
    icon: 'fa-gauge-high'
  },
  bodega: {
    name: 'Precios al Día (Bodega)',
    shortName: 'BODEGA',
    prefix: 'PDA-',
    salt: 'PRECIOS_ALDIA_BODEGA_2024_SECURE_SALT_V1',
    color: '#38bdf8',
    icon: 'fa-shop'
  },
  comida_rapida: {
    name: 'Precios al Día (Comida Rápida)',
    shortName: 'COMIDA RÁPIDA',
    prefix: 'CRP-',
    salt: 'PRECIOS_ALDIA_COMIDA_RAPIDA_2026',
    color: '#fb7185',
    icon: 'fa-burger'
  }
};
