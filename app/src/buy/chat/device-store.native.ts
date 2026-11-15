// On iOS and Android, localStorage is SQLite on the device (expo-sqlite). Web keeps the browser's own: see device-store.ts.
import 'expo-sqlite/localStorage/install';
