// The camera's coach for one shot, drawn the way Apple's Measure coaches (Nate, words.md 2026-11-15: "svg animations that
// are like apples style with the measure app"): a white line drawing of what to frame, with a phone outline sweeping
// slowly across it, and the shot's name and one line under it in place of a sentence across the top. Why a part: every
// capture family's steps use it (jobs/capture/process.json), and the parts sheet draws each glyph.
//   step   the process step's key (front, back, tag, soles, scan, ...); an unknown step draws the plain frame.
//   family the capture family picked first; front and back are drawn as a garment only for clothing.
//   words  the server's own words for a retake or an added shot, which replace the line.
// It never takes a press (pointerEvents none). Reduce Motion: the drawing is still and the phone does not move.
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { Txt } from '../text';
import { motion, space } from '../tokens.generated';
import { mark } from './mark';
import { useBar } from './camera';
import { SHOT, type Glyph } from '@/capture/shots';

const W = 160, SWEEP = 22;
// The shot's short name, for the line at the top once the coach has faded.
export const shotTitle = (step: string, words?: string) => SHOT[step]?.title ?? words ?? 'Next photo';

function Drawing({ glyph, ink }: { glyph: Glyph; ink: string }) {
  const s = { stroke: ink, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (glyph) {
    case 'garment': return <Path {...s} d="M60 30 L40 38 L20 64 L38 78 L46 70 L46 134 L114 134 L114 70 L122 78 L140 64 L120 38 L100 30 Q95 44 80 44 Q65 44 60 30 Z" />;
    case 'label': return <>
      <Rect {...s} x={46} y={36} width={68} height={88} rx={8} />
      <Circle {...s} cx={80} cy={52} r={4} />
      <Line {...s} x1={58} y1={76} x2={102} y2={76} /><Line {...s} x1={58} y1={90} x2={102} y2={90} /><Line {...s} x1={58} y1={104} x2={86} y2={104} />
    </>;
    case 'sole': return <>
      <Path {...s} d="M80 18 C104 18 112 44 110 68 C108 88 102 96 102 114 C102 134 94 144 80 144 C66 144 58 134 58 114 C58 96 52 88 50 68 C48 44 56 18 80 18 Z" />
      <Line {...s} x1={62} y1={52} x2={98} y2={52} /><Line {...s} x1={60} y1={68} x2={100} y2={68} /><Line {...s} x1={66} y1={120} x2={94} y2={120} />
    </>;
    case 'around': return <>
      <Rect {...s} x={56} y={40} width={48} height={64} rx={8} />
      <Ellipse {...s} cx={80} cy={118} rx={58} ry={16} strokeDasharray="4 6" />
      <Path {...s} d="M128 108 L138 118 L126 124" />
    </>;
    case 'cover': return <><Rect {...s} x={48} y={26} width={64} height={108} rx={4} /><Line {...s} x1={58} y1={26} x2={58} y2={134} /></>;
    case 'barcode': return <>
      <Rect {...s} x={36} y={46} width={88} height={68} rx={6} />
      {[50, 56, 64, 70, 78, 84, 92, 100, 106, 112].map((x, i) => <Line key={x} {...s} strokeWidth={i % 3 === 0 ? 3 : 1.5} x1={x} y1={58} x2={x} y2={94} />)}
    </>;
    case 'screen': return <><Rect {...s} x={44} y={22} width={72} height={116} rx={12} /><Line {...s} x1={56} y1={40} x2={104} y2={40} /><Line {...s} x1={56} y1={56} x2={96} y2={56} /><Line {...s} x1={56} y1={72} x2={100} y2={72} /></>;
    case 'box': return <Path {...s} d="M80 28 L126 52 L126 108 L80 132 L34 108 L34 52 Z M34 52 L80 76 L126 52 M80 76 L80 132" />;
    default: return <Rect {...s} x={38} y={30} width={84} height={100} rx={10} />;
  }
}

export function ShotGuide({ step, family = null, words }: { step: string; family?: string | null; words?: string }) {
  const b = useBar(), still = useReducedMotion();
  const known = SHOT[step] ?? { glyph: 'plain' as Glyph, title: words ?? 'Next photo', line: '' };
  // A front or back is drawn as a garment only for clothing; a card, a watch or something else gets the plain frame.
  const flat = (step === 'front' || step === 'back') && family !== 'apparel';
  const shot = flat ? { ...known, glyph: 'plain' as Glyph, line: step === 'front' ? 'Straight on, fill the frame.' : 'Turn it over, same distance.' } : known;
  const x = useSharedValue(-SWEEP);
  useEffect(() => {
    if (still) { x.set(0); return; }
    x.set(withRepeat(withSequence(withTiming(SWEEP, { duration: 1400 }), withTiming(-SWEEP, { duration: 1400 })), -1, false));
  }, [still, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Animated.View key={step} {...mark('shot-guide', { step })} pointerEvents="none" entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)}
      style={{ alignItems: 'center', gap: space.s4 }}>
      <Animated.View entering={ZoomIn.duration(motion.select * 2).reduceMotion(ReduceMotion.System)} style={{ width: W, height: W }}>
        <Svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}><Drawing glyph={shot.glyph} ink={b.on} /></Svg>
        {/* The phone, as Measure draws it: an outline that moves, so the person knows to hold the phone over the thing. */}
        <Animated.View style={[{ position: 'absolute', right: 6, bottom: -6 }, sweep]}>
          <Svg width={36} height={64} viewBox="0 0 36 64">
            <Rect x={2} y={2} width={32} height={60} rx={7} stroke={b.on} strokeWidth={2} fill={b.bar} fillOpacity={0.55} />
            <Line x1={14} y1={8} x2={22} y2={8} stroke={b.on} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={{ alignItems: 'center', gap: space.s1, paddingHorizontal: space.s6 }} accessibilityLiveRegion="polite">
        <Txt role="headline" tone={b.tone} center>{shot.title}</Txt>
        {words && SHOT[step] ? <Txt role="body" tone={b.tone} center>{words}</Txt> : shot.line ? <Txt role="body" tone={b.tone} center>{shot.line}</Txt> : null}
      </View>
    </Animated.View>
  );
}
