import { Alert, Linking } from 'react-native';
import type { Package } from '../api/types';

/** Deja solo dígitos; números mexicanos de 10 dígitos se completan con lada 52. */
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = `52${digits}`;
  return digits;
}

async function open(url: string, fallbackMsg: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No se pudo abrir', fallbackMsg);
  }
}

export function callPhone(phone: string): Promise<void> {
  const clean = phone.replace(/[^\d+]/g, '');
  return open(`tel:${clean}`, 'No se pudo iniciar la llamada.');
}

export function openWhatsApp(phone: string): Promise<void> {
  return open(`https://wa.me/${whatsappNumber(phone)}`, 'No se pudo abrir WhatsApp.');
}

export function googleMapsUrl(pkg: Package): string {
  const dest = pkg.location ? `${pkg.location.lat},${pkg.location.lng}` : encodeURIComponent(pkg.address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export function wazeUrl(pkg: Package): string {
  if (pkg.location) return `https://waze.com/ul?ll=${pkg.location.lat},${pkg.location.lng}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(pkg.address)}&navigate=yes`;
}

export function chooseNavigation(pkg: Package): void {
  Alert.alert('Navegar', '¿Con qué aplicación quieres navegar?', [
    { text: 'Google Maps', onPress: () => void open(googleMapsUrl(pkg), 'No se pudo abrir Google Maps.') },
    { text: 'Waze', onPress: () => void open(wazeUrl(pkg), 'No se pudo abrir Waze.') },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}
