import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { recorder } from '@/log/boundary';
import type { CrashEntry } from '../../../../log/crash.js';
import { Nav, Pill, Screen, Stack, Txt } from '@/ui';

export default function Crashes() {
  const [entries, setEntries] = useState<CrashEntry[]>([]);
  const [failure, setFailure] = useState('');
  const refresh = useCallback(() => {
    try { setEntries(recorder.readCrashes()); setFailure(''); }
    catch (error) { setFailure(String(error)); }
  }, []);
  useFocusEffect(refresh);
  return <Screen nav={<Nav />}>
    <Txt role="headline">Crashes</Txt>
    <Pill id="refresh-crashes" label="Refresh" onPress={refresh} />
    {failure ? <Txt>{failure}</Txt> : null}
    {!failure && !entries.length ? <Txt>No crashes recorded</Txt> : null}
    {entries.map(entry => <Stack key={`${entry.session}#${entry.seq}`}>
      <Txt>{entry.ts} · {entry.fatal ? 'Fatal' : 'Error'}</Txt>
      <Txt>{entry.route}</Txt>
      <Txt>{entry.error?.type}: {entry.error?.msg}</Txt>
      <Txt>{entry.error?.stack}</Txt>
      {entry.componentStack ? <Txt>{entry.componentStack}</Txt> : null}
      {entry.breadcrumbs.map((crumb, index) => <Txt key={index}>{crumb.ts} {crumb.event} {JSON.stringify(crumb)}</Txt>)}
    </Stack>)}
  </Screen>;
}
