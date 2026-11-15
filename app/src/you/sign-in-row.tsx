// A site that signed the person out, at the top of You, with the one act that fixes it: Sign in, which opens that site's own
// sign-in (Ben 06:19: "the site sign you out thing that should click on something to sign back in"). One tap on the pill starts
// it, in place: the person never leaves You, and the row says where they are. The row itself is not a button, so it shows no
// chevron beside the pill.
import { Icon, Pill, SITES } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import type { Site } from '@/demo';
import type { LinkState } from './state';

// The site's logo leads the row, so its name is not written again (Ben 06:19: the logo, never the name in words).
export function SignInRow({ site, link, onSignIn }: { site: Site; link: LinkState; onSignIn: () => void }) {
  const name = SITES[site].name, s = link.state;
  const label = s === 'connected' ? 'Linked again' : s === 'loading' ? 'Signing in' : link.tried ? 'Didn’t link' : link.note ?? 'Signed you out';
  const detail = s === 'connected' ? 'Selling there again' : s === 'loading' ? `Finish on ${name}’s own page` : link.tried ? link.note ?? undefined : 'Nothing sells there until you sign in';
  const trail = s === 'connected'
    ? <Icon name="checkmark-circle-02" label="Linked" />
    : <Pill id={`you-signin-${site}`} kind="second" label={link.tried ? 'Try again' : 'Sign in'} state={s === 'loading' ? 'working' : 'idle'} onPress={onSignIn} />;
  return <ListRow id={`you-signed-out-${site}`} site={site} label={label} detail={detail} trail={trail} tone={s === 'error' ? 'brick' : 'ink'} />;
}
