// What a person can do to a page's subject that is not today's decision: plain ruled rows at the end of the page, the
// one that cannot be undone last (brand Art. 7.9). Sold elsewhere, Keep it, Delete. A row is the content width by 52: the
// action in body ink, and one caption when it needs one ("Ends both listings"); a refused row keeps its place, its words
// in the second ink, and says why in its caption (ways-out.md, Refused on purpose: say why in one line, never hide it).
// A refused row is not a button at all, so nothing about it looks pressable (U1). Rows go in a List, which draws the
// hairlines. The chevron says the row leads somewhere.
import { View } from 'react-native';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { space } from '../tokens.generated';
import { mark } from './mark';

const H = 52;

export function ActionRow({ id, label, line, refused, onPress }: {
  id: string;
  // A verb and its object: "Sold elsewhere", "Delete".
  label: string;
  // What it will do, in a few words: "Ends both listings".
  line?: string;
  // Why it can't be done now; the row stays, and a tap does nothing.
  refused?: string;
  onPress?: () => void;
}) {
  const c = useColors();
  if (refused) {
    return (
      <View testID={id} accessibilityLabel={`${label}. ${refused}`} {...mark('action-row', { state: 'disabled' })}
        style={{ height: H, justifyContent: 'center' }}>
        <Txt role="body" tone="ink-2" lines={1}>{label}</Txt>
        <Txt role="caption" lines={1}>{refused}</Txt>
      </View>
    );
  }
  return (
    <Press id={id} label={label} onPress={onPress} round={false}>
      {({ pressed }) => (
        <View {...mark('action-row', { state: pressed ? 'pressed' : 'rest' })}
          style={{ height: H, flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: pressed ? c.gray : 'transparent' }}>
          <View style={{ flex: 1, gap: 0 }}>
            <Txt role="body" lines={1}>{label}</Txt>
            {line ? <Txt role="caption" lines={1}>{line}</Txt> : null}
          </View>
          <Icon name="arrow-right-01" size={20} tone="ink-2" />
        </View>
      )}
    </Press>
  );
}
