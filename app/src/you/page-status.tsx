// How every page under You draws the three states that come from the network (Art. 5; frontend-standard §3). loading: gray
// shapes where the rows will be, so nothing moves when they come. failed: what didn't load, that nothing changed, and Retry.
// offline: the last copy, under a line that says so; a change made now is sent when the signal is back (ways-out, Everywhere).
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ScreenState } from '@/demo/screen';
import { EmptyState, Skeleton, Stack } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';

export function PageStatus({ asked, what, children }: { asked: ScreenState | null; what: string; children: ReactNode }) {
  if (asked === 'loading') return <Stack><Skeleton of="notice" /><Skeleton of="notice" /><Skeleton of="notice" /></Stack>;
  if (asked === 'failed') {
    return <EmptyState title={`Couldn’t load ${what}`} line="The site didn’t answer."
      action={{ id: 'page-retry', label: 'Retry', onPress: () => router.setParams({ state: '' }) }} />;
  }
  if (asked === 'offline') {
    return (
      <>
        <ListRow id="page-offline" lead="refresh" label="Waiting for signal" detail="Showing saved data; changes send when the signal returns" />
        {children}
      </>
    );
  }
  return <>{children}</>;
}
