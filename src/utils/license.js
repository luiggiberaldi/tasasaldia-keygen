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
    name: 'Precios al Día (Revendedores)',
    shortName: 'REVENDEDORES',
    prefix: 'RVRS-',
    legacyPrefix: 'TASAS-',
    appName: 'TasasAlDia',
    salt: import.meta.env.VITE_LICENSE_SALT_TASAS,
    color: '#fcd535',
    icon: 'fa-gauge-high'
  },
  bodega: {
    name: 'Precios al Día (Bodega)',
    shortName: 'BODEGA',
    prefix: 'PDA-',
    appName: 'TasasAlDia_Bodegas',
    salt: import.meta.env.VITE_LICENSE_SALT_BODEGA,
    color: '#38bdf8',
    icon: 'fa-shop'
  },
  comida_rapida: {
    name: 'Precios al Día (Comida Rápida)',
    shortName: 'COMIDA RAPIDA',
    prefix: 'CRP-',
    appName: 'TasasAlDia_ComidaRapida',
    salt: import.meta.env.VITE_LICENSE_SALT_COMIDA,
    color: '#fb7185',
    icon: 'fa-burger'
  }
};
