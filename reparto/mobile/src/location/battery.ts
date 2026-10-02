import * as Battery from 'expo-battery';

/** Nivel de batería 0..1, o `undefined` si no se puede leer. */
export async function readBattery(): Promise<number | undefined> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (typeof level !== 'number' || level < 0 || Number.isNaN(level)) return undefined;
    return Math.round(level * 100) / 100;
  } catch {
    return undefined;
  }
}
