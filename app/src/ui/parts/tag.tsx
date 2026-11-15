// A state, as a word and an icon on its fill (Art. 5, States). 24 tall, a 16 icon 4 from the near end, the word at 15 (Ben,
// 09:59: "the little tags for pickup or offers etc" were "just too small"), 8 from
// the far end (Art. 7.7). It is flat: a tag never looks pressable (frontend-standard §5).
// On a photo it is a soft gradient from the hue's tint to its fill (Ben, round 7). On a field it goes white, so it does not vanish (C2).
import { View, type ViewStyle } from 'react-native';
import { Icon } from '../icon';
import { TAGS, type TagState } from '../states';
import { Txt } from '../text';
import { Theme, useColors, useGround } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark } from './mark';

type TagProps = {
  state: TagState;
  // The word, when the kind says more than the state: "Offer", "Ship by Tue". It defaults to the state's own word.
  word?: string;
  place?: 'inline' | 'photo';
  // Quiet: the state's icon and word on gray, in the mode, for an item under a header that already names its group, so the
  // color is not said twice (Art. 7.14, U13). The one colored card on a screen keeps its color.
  quiet?: boolean;
};

// A state fill takes black text in both modes (Art. 5, Dark mode line 4), so it is drawn in the light palette. Draft and ended stay in the mode.
export function Tag(p: TagProps) {
  return TAGS[p.state].ink === 'ink-2' || p.quiet ? <TagBody {...p} /> : <Theme scheme="light"><TagBody {...p} /></Theme>;
}

function TagBody({ state, word, place = 'inline', quiet = false }: TagProps) {
  const c = useColors(), ground = useGround();
  const t = TAGS[state];
  const fillOf = (k: string) => (c as Record<string, string>)[k];
  const tint = fillOf(`${t.fill}Tint`);
  let fill: ViewStyle = { backgroundColor: fillOf(t.fill) };
  if (quiet) fill = { backgroundColor: c.gray };
  else if (state === 'hot') fill = { backgroundColor: c.hot2, backgroundImage: `linear-gradient(120deg, ${c.hot1}, ${c.hot2})` } as ViewStyle;
  else if (ground === 'field') fill = { backgroundColor: c.surface };
  else if (place === 'photo' && tint) fill = { backgroundColor: fillOf(t.fill), backgroundImage: `linear-gradient(120deg, ${tint}, ${fillOf(t.fill)})` } as ViewStyle;
  const edge = state === 'draft' ? { borderWidth: 1, borderColor: c.rule } : {};
  const soft = t.ink === 'ink-2';
  return (
    <View
      {...mark('tag', { state, fit: 'content', ...(quiet ? { quiet: 'true' } : {}) })}
      accessibilityLabel={word ?? t.word}
      style={[{ height: size.tagH, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: space.s1, paddingLeft: space.s1, paddingRight: space.s2, alignSelf: 'flex-start', ...FLAT }, fill, edge]}>
      <Icon name={t.icon} size={size.tagIcon as 16} tone={quiet ? 'ink' : t.iconInk ?? (t.ink === 'ink-2' ? 'ink-2' : 'ink')} />
      <Txt role="body" tone={soft && !quiet ? 'ink-2' : 'ink'} lines={1}>{word ?? t.word}</Txt>
    </View>
  );
}
