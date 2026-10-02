import { useCallback, useState } from 'react';
import type { LatLng } from '../api/types';
import type { Fix } from '../components/LocationCapture';
import { getCurrentFix } from '../location/current';
import { haversineMeters } from './geo';

/** Ubicación + hora del momento de la evidencia y distancia al destino del paquete. */
export function useEvidenceFix(destination: LatLng | null | undefined) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    setBusy(true);
    setError(null);
    const at = new Date().toISOString();
    try {
      const f = await getCurrentFix();
      // occurredAt = momento en que se tomó la evidencia (no cuando llegó el GPS).
      setFix({ location: f.location, accuracy: f.accuracy, at });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setBusy(false);
    }
  }, []);

  const distance = fix && destination ? haversineMeters(fix.location, destination) : null;
  return { fix, busy, error, distance, capture };
}
