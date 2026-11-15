import { useEffect, useState } from 'react';
import { api, ApiFailure } from '@/api/client';
import { isHealth, type Health } from '@/health';
import { log } from '@/ui';
import { Screen, Stack, Txt } from '@/ui';

// Development placeholder until the first real screen lands: shows whether the backend answers.
export default function Index() {
  const [health, setHealth] = useState<Health | 'loading' | 'unreachable'>('loading');
  useEffect(() => {
    // Through the app's one client, so a simulator or phone reaches the dev server, not its own localhost (AP1).
    api.call<unknown>('GET /v1/health').then(h => setHealth(isHealth(h) ? h : 'unreachable'), e => {
      // A 503 still names Databricks' state in its body; anything else is a server that did not answer.
      if (e instanceof ApiFailure && isHealth(e.body)) { setHealth(e.body); return; }
      log.error('dev.health', e); setHealth('unreachable');
    });
  }, []);
  return (
    <Screen center>
      <Stack gap="tight">
        <Txt>secondhand</Txt>
        <Txt tone="ink-2">{line(health)}</Txt>
      </Stack>
    </Screen>
  );
}

function line(h: Health | 'loading' | 'unreachable') {
  if (h === 'loading') return 'Checking Databricks';
  if (h === 'unreachable') return 'The server did not answer';
  return h.ok ? `Databricks connected: ${h.catalog}, ${h.at}` : `Databricks not ready: ${h.state}`;
}
