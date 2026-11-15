// The nav of a main tab that is a place of its own (You): the place's name centered where Today has the wordmark, and the
// inbox on the right, 350 by 44 like Nav. Why a part: Nav centers only the wordmark, and Ben asked at 03:22 whether "You"
// should be in the wordmark face. The answer (research/today/ben/today-feed-and-card-states.md §5): no. The wordmark stays the
// one place the display face marks the brand; a tab's name is set in the text face, at 21, Medium, which gives it presence
// by size alone, as iOS titles its tabs. This is the one text-face string at 21, so it is drawn here and nowhere else.
import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { FACE } from '../fonts';
import { useColors } from '../theme';
import { size, type, weight } from '../tokens.generated';
import { IconButton } from './buttons';
import { mark } from './mark';
import { Count } from './small';

export function TabNav({ title, inbox }: { title: string; inbox?: { count: number; onPress?: () => void } }) {
  const c = useColors();
  return (
    <View {...mark('nav')} style={{ height: size.navH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ width: size.controlMin }} />
      <Text
        {...mark('place-title', { fit: 'content' })}
        accessibilityRole="header"
        numberOfLines={1}
        style={{ fontFamily: `${FACE.text}`, fontWeight: weight.text, fontSize: type.t21.fontSize, lineHeight: type.t21.lineHeight, color: c.ink }}>
        {title}
      </Text>
      <View style={{ width: size.controlMin, alignItems: 'flex-end' }}>
        {inbox ? (
          <IconButton id="nav-inbox" icon="inbox" label={inbox.count ? `Messages, ${inbox.count} new` : 'Messages'} look="plain" onPress={inbox.onPress ?? (() => router.push('/messages' as Href))}>
            {inbox.count ? <Count n={inbox.count} /> : null}
          </IconButton>
        ) : null}
      </View>
    </View>
  );
}
