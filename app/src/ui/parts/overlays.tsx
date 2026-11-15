// What sits over a screen or stands in for it: a sheet, the Undo toast, an empty screen, and a skeleton.
import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MOTIONS } from '../motion';
import { Press } from '../press';
import { Surface } from '../surface';
import { Txt } from '../text';
import { Theme, useColors, useScheme } from '../theme';
import { motion, radius, size, space } from '../tokens.generated';
import { Pill } from './buttons';
import { mark } from './mark';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// A sheet rises from the foot over a scrim, white at the 20 corner (Art. 5, Overlays), in --t-panel; a tap on the scrim closes it.
export function Sheet({ open, title, onClose, children }: { open: boolean; title?: string; onClose: () => void; children: ReactNode }) {
  const c = useColors(), scheme = useScheme();
  const ms = typeof MOTIONS.sheet.ms === 'number' ? MOTIONS.sheet.ms : motion.panel;
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Theme scheme={scheme}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(motion.select)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }}>
            <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
          <Animated.View entering={SlideInDown.duration(ms).easing(EASE_OUT).reduceMotion(ReduceMotion.System)} exiting={SlideOutDown.duration(motion.select)}>
            <Surface kind="sheet" part="sheet" box={{ paddingHorizontal: space.gutter, paddingTop: space.s6, paddingBottom: space.s8, gap: space.s4 }}>
              {title ? <Txt role="headline">{title}</Txt> : null}
              {children}
            </Surface>
          </Animated.View>
        </View>
      </Theme>
    </Modal>
  );
}

// After an action that can be undone: ink with white text, one at a time, about 5 s (frontend-standard §3, "Approve a Today card").
// The screen places it above the tab bar and drops it on onGone.
export function UndoToast({ id, text, onUndo, onGone }: { id: string; text: string; onUndo: () => void; onGone?: () => void }) {
  useEffect(() => { const t = setTimeout(() => onGone?.(), 5000); return () => clearTimeout(t); }, [onGone]);
  return (
    <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(motion.feedback)}>
      <ToastBody id={id} text={text} onUndo={onUndo} />
    </Animated.View>
  );
}
function ToastBody({ id, text, onUndo }: { id: string; text: string; onUndo: () => void }) {
  const c = useColors();
  return (
    <View {...mark('toast')} accessibilityLiveRegion="polite" style={{ height: size.buttonH, borderRadius: radius.pill, backgroundColor: c.ink, paddingLeft: space.s5, paddingRight: space.s1, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
      <View style={{ flex: 1 }}><Txt role="body" tone="on-ink" lines={1}>{text}</Txt></View>
      <Press id={id} label="Undo" onPress={onUndo}>
        <View style={{ height: size.pillCardH, paddingHorizontal: space.s4, justifyContent: 'center' }}>
          <Txt role="body" tone="on-ink">Undo</Txt>
        </View>
      </Press>
    </View>
  );
}

// An empty screen: what is not here yet and the one way to start. The headline of a moment is Clofie (Art. 6); no big
// icon over it (Art. 10.3), and it starts on the left edge like every other heading (Art. 7.5).
export function EmptyState({ title, line, action }: { title: string; line?: string; action?: { id: string; label: string; onPress?: () => void } }) {
  return (
    <View {...mark('empty')} style={{ gap: space.s3, paddingVertical: space.s8 }}>
      <Txt role="title">{title}</Txt>
      {line ? <Txt role="body" tone="ink-2">{line}</Txt> : null}
      {action ? <View style={{ flexDirection: 'row', paddingTop: space.s2 }}><Pill id={action.id} label={action.label} onPress={action.onPress} /></View> : null}
    </View>
  );
}

// A skeleton mirrors the final layout exactly, in gray (Art. 5, Loading), so nothing moves when the real part arrives.
// The screen shows it only after about 150 ms of waiting, and keeps it at least 300 ms (frontend-standard §3, Loading).
export function Skeleton({ of }: { of: 'card-decision' | 'card-item' | 'notice' }) {
  const c = useColors();
  const bar = (w: number | `${number}%`, h: number) => <View style={{ width: w, height: h, borderRadius: radius.pill, backgroundColor: c.gray }} />;
  if (of === 'notice') return <View {...mark('notice', { skeleton: 'true' })} style={{ height: size.noticeH, borderRadius: radius.pill, backgroundColor: c.gray }} />;
  const row = (
    <View style={{ flexDirection: 'row', height: size.photoCard, gap: space.s3 }}>
      <View style={{ width: size.photoCard, height: size.photoCard, borderRadius: radius.photo, backgroundColor: c.gray }} />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: space.s1 }}>{bar(64, size.tagH - 4)}{bar('70%', 14)}{bar('50%', 12)}</View>
    </View>
  );
  return (
    <View {...mark(of, { skeleton: 'true' })} accessibilityLabel="Loading"
      style={{ height: of === 'card-decision' ? size.cardDecisionH : size.cardItemH, padding: size.cardPad, gap: space.s3, borderRadius: radius.card, borderWidth: 1, borderColor: c.cardEdge, backgroundColor: c.surface }}>
      {row}
      {of === 'card-decision' ? <View style={{ flexDirection: 'row', gap: space.s2 }}>{bar(120, size.pillCardH)}{bar(96, size.pillCardH)}</View> : null}
    </View>
  );
}
