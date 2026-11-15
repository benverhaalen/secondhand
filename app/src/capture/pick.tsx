// What the item is, asked before the camera opens (Nate, words.md 2026-11-15: "a screen first, with text header not
// centered and not all the way on the top ... with the select buttons for each product type dynamically popping into the
// screen, and then the camera"). One button per capture family (engines/capture/process.ts FAMILIES), so the shots the
// camera asks for next are that family's; "Something else" leaves it to the first photo. The step marker and the
// left-set heading are onboarding's, so the two read as one kind of page.
import { View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { Icon, type IconName } from '@/ui/icon';
import { Nav, Screen, Stack, Txt } from '@/ui';
import { Press } from '@/ui/press';
import { useColors } from '@/ui/theme';
import { motion, radius, space } from '@/ui/tokens.generated';

export const TYPES: readonly { type: string; label: string; icon: IconName }[] = [
  { type: 'apparel', label: 'Clothing', icon: 't-shirt' },
  { type: 'shoes', label: 'Shoes', icon: 'running-shoes' },
  { type: 'bags', label: 'Bags', icon: 'handbag' },
  { type: 'jewellery_watches', label: 'Jewelry and watches', icon: 'watch-01' },
  { type: 'electronics', label: 'Electronics', icon: 'laptop' },
  { type: 'furniture', label: 'Furniture', icon: 'sofa-01' },
  { type: 'lighting_home', label: 'Lamps and home', icon: 'lamp' },
  { type: 'appliances_tools', label: 'Appliances and tools', icon: 'wrench-01' },
  { type: 'media', label: 'Books, music, film', icon: 'book-02' },
  { type: 'cards_collectibles', label: 'Cards and collectibles', icon: 'cards-01' },
  { type: 'toys_lego', label: 'Toys and LEGO', icon: 'toy-brick' },
  { type: 'bikes_sports', label: 'Bikes and sports', icon: 'bicycle-01' },
  { type: 'baby_gear', label: 'Baby gear', icon: 'baby-bottle' },
  { type: 'other', label: 'Something else', icon: 'help-circle' },
];

const HEADING: Record<string, string> = { worth: 'What are you appraising?', sell: 'What are you selling?', track: 'What are you watching for?', find: 'What are you looking for?' };

export function PickType({ mode, busy, error, onPick, onClose }: { mode: string; busy: boolean; error: string | null; onPick: (type: string) => void; onClose: () => void }) {
  const c = useColors();
  return (
    <Screen name="capture-type" state={busy ? 'loading' : error ? 'failed' : 'new'} skip="empty, one, dense: the list is the fixed families; offline: a pick that cannot be saved says so as failed" nav={<Nav back={onClose} />}>
      <Stack gap="tight">
        <Txt role="caption">1 of 2</Txt>
        <Txt role="heading">{HEADING[mode] ?? HEADING.sell}</Txt>
      </Stack>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.s1 }}>
        {TYPES.map((t, i) => (
          <Animated.View key={t.type} entering={ZoomIn.duration(motion.select).delay(i * 35).reduceMotion(ReduceMotion.System)} style={{ width: '50%', padding: space.s1 }}>
            <Press id={`capture-type-${t.type}`} label={t.label} disabled={busy} round={false} onPress={() => onPick(t.type)}>
              {({ pressed }) => (
                <View style={{ minHeight: 96, padding: space.s4, gap: space.s3, justifyContent: 'space-between', borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: c.cardEdge, backgroundColor: pressed ? c.gray : c.surface, opacity: busy ? 0.5 : 1 }}>
                  <Icon name={t.icon} />
                  <Txt role="body" lines={2}>{t.label}</Txt>
                </View>
              )}
            </Press>
          </Animated.View>
        ))}
      </View>
      {error ? <Txt role="body">{error}</Txt> : null}
    </Screen>
  );
}
