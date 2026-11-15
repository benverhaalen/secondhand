// The states every buy page draws the same way (.agents/ui-states.json "screen"; app/src/demo/screen.ts): loading is the
// page's own skeleton, failed says what did not load and offers Retry, and offline shows the last copy under one line
// that says so (ways-out, Everywhere: "Waiting for signal"). Built from the kit's parts only, so a page reads as itself.
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { EmptyState, Screen, Skeleton, Stack, Txt } from '@/ui';

export function Loading({ name, nav, rows = 'card-item', skip }: { name: string; nav: ReactNode; rows?: 'card-item' | 'card-decision' | 'notice'; skip?: string }) {
  return (
    <Screen name={name} state="loading" skip={skip} nav={nav}>
      <Stack>
        <Skeleton of={rows} />
        <Skeleton of={rows} />
        <Skeleton of={rows} />
      </Stack>
    </Screen>
  );
}

// "Couldn’t load your list": what did not load, and Retry, which loads the page afresh.
export function Failed({ name, nav, what, again, skip }: { name: string; nav: ReactNode; what: string; again: Href; skip?: string }) {
  return (
    <Screen name={name} state="failed" skip={skip} nav={nav}>
      <EmptyState title={`Couldn’t load ${what}`} action={{ id: `${name}-retry`, label: 'Retry', onPress: () => router.replace(again) }} />
    </Screen>
  );
}

// Offline keeps the last copy on screen, with this line at the top.
export const OfflineLine = () => <Txt role="caption">Waiting for signal; showing saved results.</Txt>;
