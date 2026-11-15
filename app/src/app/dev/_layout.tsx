// The /dev pages (health, the parts sheet, crashes) are for building the app: a release build sends them home
// (review-app.md B6). __DEV__ is false in every build Metro makes for release.
import { Redirect, Slot } from 'expo-router';

export default function Dev() {
  return __DEV__ ? <Slot /> : <Redirect href="/" />;
}
