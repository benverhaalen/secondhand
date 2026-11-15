// One conversation in the Messages list, read the way Mail and iOS Messages read a row (Ben, 09:56: "messages should just
// list the messages"; 10:01: "standard to apple iphone design"). Why a part: ThreadRow led each row with a state tag, so the
// list read as a second Today (five yellow tags under a title); this row is only the conversation, and what waits on it is
// one quiet word, the way Mail marks a Draft. Lines, top to bottom:
//   who, and when the last message came           the person, at 18 in ink; the time at 13 and a chevron at the end
//   the thing it is about, and one quiet word       the item's short name at 15; "Draft ready", "Possible scam" at 13
//   their last words, and how many are new          15 in the second ink; the count at the end, the one unread mark
// The photo with its site's logo leads, as on every row of a thing. One size: the card's 72 row and 12 above and below,
// marked thread-row as ThreadRow is, so the two kinds of conversation row hold one height (B31).
// States: read, unread (a count), with a draft ready, flagged as a possible scam (the word in brick
// with its icon, never color alone), blocked, and with no photo.
import { View } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { FLAT, mark, type Site } from './mark';
import { Count, SiteBadge } from './small';

const ROW_H = size.photoCard + space.s3 * 2;

// The one word a row may carry, and its icon. Only a possible scam takes color: it is the one a person must not miss.
export type ConvoNote = 'draft' | 'scam' | 'auto' | 'blocked';
const NOTE: Record<ConvoNote, { word: string; icon: IconName; brick?: boolean }> = {
  draft: { word: 'Draft ready', icon: 'pencil-edit-02' },
  scam: { word: 'Possible scam', icon: 'alert-02', brick: true },
  auto: { word: 'Sent for you', icon: 'tick-02' },
  blocked: { word: 'Blocked', icon: 'cancel-01' },
};

export function ConvoRow({ id, who, photo, name, site, note, last, time, unread, onPress }: {
  id: string;
  // The buyer's name on the site.
  who: string;
  photo?: PhotoSrc | null;
  // The thing's short name ("Carhartt canvas work pants"), also the photo's label.
  name: string;
  site: Site;
  note?: ConvoNote;
  // Their last words, or the last words sent.
  last: string;
  // When the last message came: "3h ago".
  time: string;
  unread: number;
  onPress?: () => void;
}) {
  const n = note ? NOTE[note] : null;
  return (
    <Press id={id} label={[who, name, n?.word, unread ? `${unread} new` : null].filter(Boolean).join(', ')} onPress={onPress} round={false}>
      <View {...mark('thread-row')} style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View>
          <Photo src={photo} label={name} />
          <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={site} /></View>
        </View>
        <View style={{ flex: 1, height: size.photoCard, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <View style={{ flex: 1 }}><Txt role="headline" lines={1}>{who}</Txt></View>
            {/* The time and a small chevron, as iOS Messages and Mail end a row's first line: the row opens a conversation. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, ...FLAT }}>
              <Txt role="caption" tabular>{time}</Txt>
              <Icon name="arrow-right-01" size={12} tone="ink-2" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <View style={{ flex: 1 }}><Txt role="body" lines={1}>{name}</Txt></View>
            {n ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, ...FLAT }}>
                <Icon name={n.icon} size={12} tone={n.brick ? 'brick' : 'ink-2'} />
                <Txt role="caption">{n.word}</Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <View style={{ flex: 1 }}><Txt role="body" tone="ink-2" lines={1}>{last}</Txt></View>
            <Count n={unread} />
          </View>
        </View>
      </View>
    </Press>
  );
}
