// A link to a page that does not exist lands here, with a way home (Expo Router's +not-found; review-app.md B3).
import { router } from 'expo-router';
import { EmptyState, Screen } from '@/ui';

export default function NotFound() {
  return (
    <Screen name="not-found" state="empty" skip="loading, one, typical, dense, failed, offline, new: there is nothing here to load">
      <EmptyState title="This page isn’t here" line="The link may be old." action={{ id: 'not-found-home', label: 'Go to Today', onPress: () => router.replace('/') }} />
    </Screen>
  );
}
