import { FootButton, Stack, Txt } from '../ui';
import { useLiveData, type Resource } from './live';

export function DataStatus({ resources, demo = false }: { resources: Resource[]; demo?: boolean }) {
  const { problems, refresh, refreshing } = useLiveData();
  const messages = [...new Set(resources.flatMap(resource => { const message = problems[resource]; return message ? [message] : []; }))];
  if (demo || !messages.length) return null;
  return <Stack gap="tight">
    {messages.map(message => <Txt key={message} role="body" tone="ink-2">{message}</Txt>)}
    <FootButton id="data-retry" label="Try again" kind="second" state={refreshing ? 'working' : 'idle'} onPress={() => void refresh()} />
  </Stack>;
}
