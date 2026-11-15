import Constants from 'expo-constants';

export const origin = process.env.EXPO_PUBLIC_API_ORIGIN
  ?? (Constants.expoConfig?.hostUri ? `http://${Constants.expoConfig.hostUri}` : null);
