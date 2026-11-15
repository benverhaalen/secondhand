// Why this part: a queue card on Today ("40 to post", drawn as a stack) opens its items one at a time, full screen, and
// the stack under the top one shrinks as each is done (spec/pages.md §5; research/today/ben/today-feed-and-card-states.md
// §3). Reviewing one at a time is what a person does with 40 drafts; 40 cards spread in place is the long list the stack
// was meant to avoid. No part showed one item of many at full size.
// What it shows, top to bottom: Back, the kind as the page's heading and how many are left; the item's photo at column
// width with up to two layers under it for the ones still waiting (75% then 40%, scaled .97 and .93, 12 apart, as the
// card stack); its title; the agent's price as a Guess (dotted until the person changes it) and the sites as logos; the
// two ways out (Not now, Edit); and at the foot one Approve that says exactly what it will do. The price always waits
// for this tap (.agents/ui-build/README.md, the hand-off rule).
// States: ready, working (the foot says the step), failed (the foot says Retry and what failed; the item stays),
// and the toast after each one goes, with Undo. When the last one goes the screen closes it.
import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { Line, Screen, Stack } from '../layout';
import { Photo, type PhotoSrc } from '../photo';
import { Txt } from '../text';
import { Theme, useColors, useScheme } from '../theme';
import { radius, space } from '../tokens.generated';
import { Pill } from './buttons';
import { Nav } from './chrome';
import { Approve, Guess } from './loop';
import { mark, type Site } from './mark';
import { SiteBadge } from './small';

export type QueueEntry = { id: string; title: string; photo?: PhotoSrc | null; price: string; sites: Site[] };

export function QueueView({ id, open, title, does, entries, total, status = 'ready', step, failed, toast, onPrice, onApprove, onSkip, onEdit, onClose }: {
  id: string;
  open: boolean;
  // The kind, as the page's heading: "Ready to post".
  title: string;
  // What the foot does to the top one, exactly: "Post at $45 on 2 sites".
  does: string;
  // The ones still waiting, the top one first.
  entries: QueueEntry[];
  // How many there were when the queue opened, for "3 of 40".
  total: number;
  status?: 'ready' | 'working' | 'failed';
  step?: string;
  failed?: string;
  // The UndoToast for the one that just went, placed above the foot.
  toast?: ReactNode;
  onPrice?: (next: string) => void;
  onApprove: (e: QueueEntry) => void;
  onSkip: (e: QueueEntry) => void;
  onEdit: (e: QueueEntry) => void;
  onClose: () => void;
}) {
  const scheme = useScheme();
  const top = entries[0];
  return (
    <Modal visible={open && !!top} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Theme scheme={scheme}>
        {top ? (
          <Screen
            name="today-queue"
            state={status}
            nav={<Nav back={onClose} />}
            foot={
              <Stack gap="tight">
                {toast}
                <Approve id={`${id}-approve`} does={does}
                  status={status} step={step} failed={failed} onApprove={() => onApprove(top)} />
              </Stack>
            }>
            <Stack gap="tight">
              <Txt role="heading">{title}</Txt>
              <Txt role="body" tone="ink-2" tabular>{`${total - entries.length + 1} of ${total}`}</Txt>
            </Stack>
            <Stack>
              <Layers waiting={entries.length - 1}>
                <Photo src={top.photo} label={top.title} fit="fill" />
              </Layers>
              <Txt role="headline" lines={2}>{top.title}</Txt>
              <Line gap="group">
                <Guess key={top.id} id={`${id}-price`} name="Price" value={top.price} numeric onChange={onPrice} />
                <Line>{top.sites.map(s => <SiteBadge key={s} site={s} />)}</Line>
              </Line>
              <Line>
                <Pill id={`${id}-skip`} kind="second" label="Not now" state={status === 'working' ? 'disabled' : 'idle'} onPress={() => onSkip(top)} />
                <Pill id={`${id}-edit`} kind="second" label="Edit" icon="edit-02" state={status === 'working' ? 'disabled' : 'idle'} onPress={() => onEdit(top)} />
              </Line>
            </Stack>
          </Screen>
        ) : null}
      </Theme>
    </Modal>
  );
}

// The ones still waiting, drawn under the photo the way the card stack draws them: two layers at most, none for the last one.
function Layers({ waiting, children }: { waiting: number; children: ReactNode }) {
  const c = useColors(), scheme = useScheme();
  const layers = Math.min(2, waiting);
  return (
    <View {...mark('queue-stack', { waiting: String(waiting), fit: 'content' })} style={{ paddingBottom: space.s3 * layers }}>
      {Array.from({ length: layers }, (_, n) => layers - 1 - n).map(i => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: space.s3 * (i + 1), aspectRatio: 1, borderRadius: radius.photo, borderCurve: 'continuous',
          backgroundColor: c.surface, opacity: i === 0 ? 0.75 : 0.4, transform: [{ scale: i === 0 ? 0.97 : 0.93 }],
          ...(scheme === 'dark' ? { borderWidth: 1, borderColor: c.cardEdge } : { boxShadow: `0 6px 14px ${c.stackShade}` }) }} />
      ))}
      {children}
    </View>
  );
}
