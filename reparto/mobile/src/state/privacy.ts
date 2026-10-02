import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'reparto.privacyAccepted.v1';

export async function isPrivacyAccepted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== null;
  } catch {
    return false;
  }
}

export async function acceptPrivacy(): Promise<void> {
  await AsyncStorage.setItem(KEY, new Date().toISOString());
}
