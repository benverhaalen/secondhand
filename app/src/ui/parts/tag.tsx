// A state, as a word and an icon on its fill (Art. 5, States). 20 tall, a 12 icon 4 from the near end, the word 8 from
// the far end (Art. 7.7). It is flat: a tag never looks pressable (frontend-standard §5).
// On a photo it is a soft gradient from the hue's tint to its fill (Ben, round 7). On a field it goes white, so it does not vanish (C2).
import { View, type ViewStyle } from 'react-native';
import { Icon } from '../icon';
import { TAGS, type TagState } from '../states';
import { Txt } from '../text';
import { Theme, useColors, useGround } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { mark } from './mark';

type TagProps = {
  state: TagState;
  // The word, when the kind says more than the state: "Offer", "Ship by Tue". It defaults to the state's own word.
  word?: string;
  place?: 'inline' | 'photo';
};

// A state fill takes black text in both modes (Art. 5, Dark mode line 4), so it is drawn in the light palette. Draft and ended stay in the mode.
export function Tag(p: TagProps) {
  return TAGS[p.state].ink === 'ink-2' ? <TagBody {...p} /> : <Theme scheme="light"><TagBody {...p} /></Theme>;
}

function TagBody({ state, word, place = 'inline' }: TagProps) {
  const c = useColors(), ground = useGround();
  const t = TAGS[state];
  const fillOf = (k: string) => (c as Record<string, string>)[k];
  const tint = fillOf(`${t.fill}Tint`);
  let fill: ViewStyle = { backgroundColor: fillOf(t.fill) };
  if (state === 'hot') fill = { backgroundColor: c.hot2, backgroundImage: `linear-gradient(120deg, ${c.hot1}, ${c.hot2})` } as ViewStyle;
  else if (ground === 'field') fill = { backgroundColor: c.surface };
  else if (place === 'photo' && tint) fill = { backgroundColor: fillOf(t.fill), backgroundImage: `linear-gradient(120deg, ${tint}, ${fillOf(t.fill)})` } as ViewStyle;
  const edge = state === 'draft' ? { borderWidth: 1, borderColor: c.rule } : {};
  const quiet = t.ink === 'ink-2';
  return (
    <View
      {...mark('tag', { state, fit: 'content' })}
      accessibilityLabel={word ?? t.word}
      style={[{ height: size.tagH, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.s1, paddingLeft: space.s1, paddingRight: space.s2, alignSelf: 'flex-start' }, fill, edge]}>
      <Icon name={t.icon} size={12} tone={t.iconInk ?? (quiet ? 'ink-2' : 'ink')} />
      <Txt role="caption" tone={quiet ? 'ink-2' : 'ink'} lines={1}>{word ?? t.word}</Txt>
    </View>
  );
}
