// One site's row wherever sites are linked (first launch and Your sites): its logo, its state in words, and the one act that
// state allows. Ben, 03:22: "when you connect theres a loading and good state and also error states to retry also you can
// move on without connecting all of them". Each row runs on its own, so a site that is signing in never blocks the rest.
import { Icon, Pill } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import type { Site } from '@/demo';
import type { LinkState } from './state';

const WORD = { connected: 'Linked', loading: 'Signing in', error: 'Needs you', not_connected: 'Not linked' } as const;

export function LinkRow({ site, link, detail, onLink, onOpen }: {
  site: Site;
  link: LinkState;
  // A second line: what linking does here, or when it was last checked.
  detail?: string;
  onLink: () => void;
  // A linked site opens its own sheet (Unlink lives there).
  onOpen?: () => void;
}) {
  const s = link.state;
  // An error says what failed under the state word: a sign-in that ended, or a try that did not finish.
  const label = s === 'error' && link.tried ? 'Didn’t link' : WORD[s];
  const second = s === 'error' && link.note ? (detail ? `${link.note}. ${detail}` : link.note) : detail;
  const trail = s === 'connected'
    ? (onOpen ? undefined : <Icon name="checkmark-circle-02" label="Linked" />)
    : <Pill id={`link-${site}`} kind="second" label={s === 'error' ? 'Try again' : 'Link'} icon={s === 'error' ? 'refresh' : undefined} state={s === 'loading' ? 'working' : 'idle'} onPress={onLink} />;
  return <ListRow id={`site-row-${site}`} site={site} label={label} detail={second} trail={trail} tone={s === 'error' ? 'brick' : 'ink'} onPress={s === 'connected' ? onOpen : undefined} />;
}
