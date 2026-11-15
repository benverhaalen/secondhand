// The capture frame (research/capture/ben/listing-photo-frame.md §4; Ben, 06:19: "ensure the frame size is whatever the
// photo size should be ... be intentional about the frame size that you intend to put on these sites").
//
// Why it exists: the camera shoots for nine sites whose first photo runs from 3:4 upright (Poshmark) through 4:5 (Vinted,
// Grailed) to square (eBay, Depop, Mercari, Facebook, OfferUp, Etsy's shop). A 3:4 upright still is the phone's own photo
// held up, and every one of those cuts out of it without padding, which eBay bans. The item belongs in the centered square,
// since the square is what most buyers see first and it survives every cut; four ticks mark it.
//
// Drawn as the phone's camera draws 4:3 and 1:1: the feed outside the frame dimmed, four crisp corners, nothing else. What
// the camera has read sits in the frame's band under the square, on the feed and off the item, so facts are not mistaken
// for the controls on the bar below (Ben, 06:19: the modes "kind of mesh with the different features").
//
// States: drawn (the bars are measured and the frame sits between them) and waiting (not yet measured: nothing is drawn,
// so the frame never jumps). A screen with no feed (camera off) does not draw it.
//
// Sizes that are not tokens, each with its reason:
//   ASPECT 3/4   the capture shape, from the research note.
//   DIM 0.6      the dim outside the frame: the feed still shows, as the phone's camera keeps it, and the frame reads first.
//   CORNER 20    a corner's arm: long enough to read as a corner at a glance, short of drawing a box.
//   EDGE 2       a corner's stroke: a hairline is lost over a photo.
//   TICK 12      a tick of the square: shorter than a corner, so the frame reads first and the square second.
import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { space } from '../tokens.generated';
import { useBar } from './camera';
import { mark } from './mark';

export const ASPECT = 3 / 4;
const DIM = 0.6;
const CORNER = 20;
const EDGE = 2;
const TICK = 12;
const SAMPLE = 240;

export type Rect = { x: number; y: number; width: number; height: number };

// The largest 3:4 upright frame that fits the open feed between the bars, centered, with 8 of dim on its tightest side.
export function frameRect(area: Rect, inset: number = space.s2): Rect {
  const width = Math.max(0, Math.min(area.width - 2 * inset, (area.height - 2 * inset) * ASPECT));
  const height = width / ASPECT;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

// The frame over the feed, between a top bar `top` tall and a foot `bottom` tall. `band` sits in the frame under the square.
// `sample` draws it alone at the parts sheet's size.
export function CaptureFrame({ top = 0, bottom = 0, band, sample = false }: { top?: number; bottom?: number; band?: ReactNode; sample?: boolean }) {
  const b = useBar();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const measure = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; setBox(o => (o && o.width === width && o.height === height ? o : { width, height })); };
  const f = box && box.height - top - bottom > 0 ? frameRect({ x: 0, y: top, width: box.width, height: box.height - top - bottom }) : null;
  const side = f ? f.width : 0, sq = f ? f.y + (f.height - side) / 2 : 0;
  const dim = (s: ViewStyle) => <View style={[{ position: 'absolute', backgroundColor: b.bar, opacity: DIM }, s]} />;
  const corner = (s: ViewStyle) => <View style={[{ position: 'absolute', width: CORNER, height: CORNER, borderColor: b.on }, s]} />;
  const tick = (s: ViewStyle) => <View style={[{ position: 'absolute', width: TICK, height: EDGE, backgroundColor: b.on }, s]} />;
  return (
    <View onLayout={measure} pointerEvents="box-none" style={sample ? { height: SAMPLE, alignSelf: 'stretch', overflow: 'hidden' } : fill}>
      {f ? (
        <>
          {dim({ left: 0, right: 0, top: 0, height: f.y })}
          {dim({ left: 0, right: 0, top: f.y + f.height, bottom: 0 })}
          {dim({ left: 0, width: f.x, top: f.y, height: f.height })}
          {dim({ right: 0, width: box!.width - f.x - f.width, top: f.y, height: f.height })}
          <View {...mark('capture-frame', { aspect: '3:4' })} pointerEvents="none" style={{ position: 'absolute', left: f.x, top: f.y, width: f.width, height: f.height }}>
            {corner({ left: 0, top: 0, borderLeftWidth: EDGE, borderTopWidth: EDGE })}
            {corner({ right: 0, top: 0, borderRightWidth: EDGE, borderTopWidth: EDGE })}
            {corner({ left: 0, bottom: 0, borderLeftWidth: EDGE, borderBottomWidth: EDGE })}
            {corner({ right: 0, bottom: 0, borderRightWidth: EDGE, borderBottomWidth: EDGE })}
            <View {...mark('capture-square')} style={{ position: 'absolute', left: 0, right: 0, top: sq - f.y, height: side }}>
              {tick({ left: 0, top: 0 })}{tick({ right: 0, top: 0 })}
              {tick({ left: 0, bottom: 0 })}{tick({ right: 0, bottom: 0 })}
            </View>
          </View>
          {band ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: f.x, width: f.width, top: sq + side, height: f.y + f.height - sq - side, justifyContent: 'center' }}>{band}</View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const fill: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
