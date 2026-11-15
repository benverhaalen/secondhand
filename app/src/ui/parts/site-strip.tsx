// Where a search looked, site by site, with what each one said (pages §6.13 "sites fill in as they answer, with the real
// counts"; §6.14 Want "sites, checked times per site"). Why a part: the honest state of a search that runs on five sites
// at once is per site, and a sentence ("3 of 5 sites answered") hides which one is late. Each site is its own square
// logo (C5) over one caption, in five fixed slots, so a site answering changes its caption and nothing moves (U7).
// A slot is: in (what it found: "41", "4m ago"), waiting (a small spinner where the caption goes: still answering),
// none (it answered with nothing: "None"), behind (its check failed and is being retried: "Behind", in ink, since it is
// the one that needs a look; watch.md), or off (the person left it out: "Off").
// With onToggle (a want's Where) each slot is a tile that turns its site on or off: a logo over a caption reads as a
// report, not a control, so a toggle slot sits on a gray tile 64 wide (a pressable shape, U1), and an off one is an empty
// tile with a hairline, its logo faded and its caption "Off": on and off differ in shape and words, not in hue (Art. 5).
// The logo stays its one size in both, so a row of them keeps one height (C5). The kit's site Chip draws a picked logo
// smaller than an unpicked one inside its ring, which breaks that rule in a mixed row, so it is not used here.
import { ActivityIndicator, View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space, type } from '../tokens.generated';
import { FLAT, mark, SITES, type Site } from './mark';
import { SiteBadge } from './small';

export type SiteSlot = { site: Site; state: 'in' | 'waiting' | 'none' | 'behind' | 'off'; note?: string };

export function SiteStrip({ id, slots, onToggle }: { id: string; slots: SiteSlot[]; onToggle?: (site: Site) => void }) {
  const c = useColors();
  return (
    <View {...mark('site-strip')} style={{ flexDirection: 'row' }}>
      {slots.map(s => (
        <View key={s.site} style={{ width: '20%', alignItems: 'flex-start' }}>
          {onToggle ? (
            <Press id={`${id}-${s.site}`} label={`${SITES[s.site].name}, ${s.state === 'off' ? 'off' : 'on'}`} selected={s.state !== 'off'} onPress={() => onToggle(s.site)} round={false}>
              {({ pressed }) => (
                <View {...mark('site-toggle', { on: s.state === 'off' ? 'false' : 'true' })}
                  style={{ width: space.s9 + 2, paddingVertical: space.s2, alignItems: 'center', borderRadius: radius.photo, borderCurve: 'continuous',
                    backgroundColor: s.state === 'off' ? 'transparent' : pressed ? c.grayPress : c.gray, borderWidth: 1, borderColor: s.state === 'off' ? c.rule : 'transparent' }}>
                  <Slot slot={s} centered />
                </View>
              )}
            </Press>
          ) : <Slot slot={s} />}
        </View>
      ))}
    </View>
  );
}

function Slot({ slot, centered = false }: { slot: SiteSlot; centered?: boolean }) {
  const c = useColors();
  const words = slot.state === 'off' ? 'Off' : slot.state === 'none' ? 'None' : slot.state === 'behind' ? 'Retrying' : slot.note ?? '';
  return (
    <View {...mark('site-slot', { state: slot.state })} accessibilityLabel={`${SITES[slot.site].name}: ${slot.state === 'waiting' ? 'still searching' : slot.state === 'behind' ? 'retrying search' : words}`}
      style={{ gap: space.s1, height: size.siteBadge + space.s1 + type.t13.lineHeight, width: space.s9, alignItems: centered ? 'center' : 'flex-start', ...FLAT }}>
      <View style={{ opacity: slot.state === 'off' ? 0.4 : 1 }}><SiteBadge site={slot.site} /></View>
      <View style={{ height: type.t13.lineHeight, justifyContent: 'center', alignItems: centered ? 'center' : 'flex-start' }}>
        {slot.state === 'waiting' ? <ActivityIndicator size="small" color={c.ink2} style={{ transform: [{ scale: 0.7 }] }} /> : <Txt role="caption" tone={slot.state === 'in' || slot.state === 'behind' ? 'ink' : 'ink-2'} lines={1}>{words}</Txt>}
      </View>
    </View>
  );
}
