import { useEffect, useState } from 'react';
import { isHealth, type Health } from '@/health';
import { Screen, Stack } from '@/ui/layout';
import { Txt } from '@/ui/text';

// Development placeholder until the first real screen lands: shows whether the backend answers.
export default function Index() {
  const [health, setHealth] = useState<Health | 'loading' | 'unreachable'>('loading');
  useEffect(() => {
    fetch('/v1/health').then(r => r.json()).then((h: unknown) => setHealth(isHealth(h) ? h : 'unreachable'), () => setHealth('unreachable'));
  }, []);
  return (
    <Screen center>
      <Stack gap="tight">
        <Txt>secondhand</Txt>
        <Txt quiet>{line(health)}</Txt>
      </Stack>
    </Screen>
  );
}

function line(h: Health | 'loading' | 'unreachable') {
  if (h === 'loading') return 'Checking Databricks';
  if (h === 'unreachable') return 'The server did not answer';
  return h.ok ? `Databricks connected: ${h.catalog}, ${h.at}` : `Databricks not ready: ${h.state}`;
}
