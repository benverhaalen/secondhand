// The way back to the site, and the site's own picture of what it shows.
//
// SiteLink: why it exists. Every page about a sale, a pickup or a thread keeps a way back to the site it happened on
// (Ben, 06:19: "you should always have a way to go back to the site"). It is a second pill, 40 tall, with the site's logo
// at 24 where a pill's icon sits and "Open on the site": the logo says which site, never its name in words (C5).
// States: idle, pressed.
//
// SiteCopy: why it exists. Where a person has to trust what we say a site shows (a pickup time, a buyer's words, a ship-by
// date), the sheet shows the site's own screenshot, saved when the agent last read or wrote there, with when it was saved
// (Ben, 06:19: "It should use screenshots from the site when you need to verify certain things like scheduling";
// spec/edge-cases.md §16, "Proof the agent got it right"). With no screenshot saved yet it says so, and still opens the site.
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Press, slop } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { Line, Stack } from '../layout';
import { Photo, type PhotoSrc } from '../photo';
import { mark, SITES, type Site } from './mark';
import { Sheet } from './overlays';

export function SiteLink({ id, site, onPress }: { id: string; site: Site; onPress: () => void }) {
  const c = useColors();
  return (
    <Press id={id} label={`Open on ${SITES[site].name}`} onPress={onPress} hit={slop(88, size.pillCardH, { x: space.s2 })}>
      {({ pressed }) => (
        <View {...mark('site-link', { fit: 'content' })}
          style={{ height: size.pillCardH, flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingLeft: space.s2, paddingRight: size.pillCardPad,
            borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: pressed ? c.grayPress : c.gray }}>
          <View style={{ width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c.surface }}>
            <Image source={SITES[site].logo} alt={SITES[site].name} accessibilityLabel={SITES[site].name} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
          <Txt role="body" lines={1}>Open on the site</Txt>
        </View>
      )}
    </Press>
  );
}

export function SiteCopy({ id, open, site, shot, saved, onOpen, onClose }: {
  id: string;
  open: boolean;
  site: Site;
  // The saved screenshot, and when it was saved in words ("Saved today at 11:52 am"). Absent until the agent has saved one.
  shot?: PhotoSrc | null;
  saved?: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} title="As the site shows it" onClose={onClose}>
      <Stack>
        {shot ? (
          <Stack gap="tight">
            <Photo src={shot} label="The site’s screenshot" fit="fill" />
            {saved ? <Txt role="caption">{saved}</Txt> : null}
          </Stack>
        ) : <Txt role="body">No screenshot saved</Txt>}
        <Line><SiteLink id={`${id}-site`} site={site} onPress={onOpen} /></Line>
      </Stack>
    </Sheet>
  );
}
