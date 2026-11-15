// Buttons. A button's size follows its kind, never its words (frontend-standard §5, Access).
// primary: the black pill, the act (C4), with its glow in light. One per view unless the rule in C4 says so (L50).
// second: the light fill with no line (L5): gray in a white card or on the page, white at 72% on a field.
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Press, slop } from '../press';
import { Txt } from '../text';
import { useColors, useGround } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { mark } from './mark';

export type PillKind = 'primary' | 'second';
// idle: ready. working: the press was taken and the work runs; the button says the step. disabled: say why nearby (Art. 5).
export type PillState = 'idle' | 'working' | 'disabled';

function useFill(kind: PillKind, pressed: boolean, state: PillState): { box: ViewStyle; tone: 'on-ink' | 'ink' } {
  const c = useColors(), ground = useGround();
  if (state === 'disabled') return { box: { backgroundColor: c.gray }, tone: 'ink' };
  if (kind === 'primary')
    return { box: { backgroundColor: pressed ? c.inkPress : c.ink, boxShadow: pressed ? undefined : `0 6px 18px ${c.glow1}, 0 2px 10px ${c.glow2}` } as ViewStyle, tone: 'on-ink' };
  if (ground === 'field') return { box: { backgroundColor: pressed ? c.surface : c.secOnField }, tone: 'ink' };
  return { box: { backgroundColor: pressed ? c.grayPress : c.gray }, tone: 'ink' };
}

// The label keeps the button's width while it works: the step is drawn over it, so nothing moves (U7).
function Label({ label, step, tone, state, icon }: { label: string; step?: string; tone: 'on-ink' | 'ink'; state: PillState; icon?: IconName }) {
  const c = useColors();
  const working = state === 'working';
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2, opacity: working ? 0 : 1 }}>
        {icon ? <Icon name={icon} size={20} tone={tone === 'on-ink' ? 'page' : 'ink'} /> : null}
        <Txt role="body" tone={state === 'disabled' ? 'ink-2' : tone} lines={1}>{label}</Txt>
      </View>
      {working ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s2 }}>
          {step ? <Txt role="body" tone={tone} lines={1}>{step}</Txt> : <ActivityIndicator size="small" color={tone === 'on-ink' ? c.page : c.ink} />}
        </View>
      ) : null}
    </>
  );
}

// A button in a card or a row: 40 tall in a 44 touch area, hugging its label with 20 a side, at least 88 wide (Art. 7.8).
export function Pill({ id, label, kind = 'primary', icon, state = 'idle', step, onPress }: {
  id: string;
  // A verb and an object, 1 to 3 words, with the amount when there is one: "Accept $38" (C4, copy.md).
  label: string;
  kind?: PillKind;
  icon?: IconName;
  state?: PillState;
  // What the work is doing now, while state is working: "Printing", "2 of 3".
  step?: string;
  onPress?: () => void;
}) {
  return (
    <Press id={id} onPress={onPress} disabled={state !== 'idle'} hit={slop(88, size.pillCardH, { x: space.s2 })}>
      {({ pressed }) => <PillBody {...{ label, kind, icon, state, step, pressed }} />}
    </Press>
  );
}
function PillBody({ label, kind, icon, state, step, pressed }: { label: string; kind: PillKind; icon?: IconName; state: PillState; step?: string; pressed: boolean }) {
  const f = useFill(kind, pressed, state);
  return (
    <View
      {...mark('pill-card', { kind, state, fit: 'content' })}
      style={[{ height: size.pillCardH, minWidth: 88, paddingLeft: icon ? space.s4 : size.pillCardPad, paddingRight: size.pillCardPad, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, f.box]}>
      <Label label={label} step={step} tone={f.tone} state={state} icon={icon} />
    </View>
  );
}

// A 40 circle in a 44 touch area (Art. 7.8). plain: an icon in a bar (the inbox, back). fill: a side action in a card (More).
export function IconButton({ id, icon, label, look = 'fill', onPress, children }: {
  id: string;
  icon: IconName;
  // What it does, for a screen reader: an icon alone says nothing to one.
  label: string;
  look?: 'fill' | 'plain';
  onPress?: () => void;
  // Something pinned to its corner: a Count.
  children?: React.ReactNode;
}) {
  const c = useColors(), ground = useGround();
  return (
    <Press id={id} label={label} onPress={onPress} hit={slop(size.pillCardH, size.pillCardH, { x: space.s2 })}>
      {({ pressed }) => (
        <View
          {...mark('icon-button')}
          style={{ width: size.pillCardH, height: size.pillCardH, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center',
            backgroundColor: look === 'plain' ? (pressed ? c.gray : 'transparent') : ground === 'field' ? (pressed ? c.surface : c.secOnField) : pressed ? c.grayPress : c.gray }}>
          <Icon name={icon} />
          {children ? <View style={{ position: 'absolute', top: -4, right: -4 }}>{children}</View> : null}
        </View>
      )}
    </Press>
  );
}

// The full-width button at the foot of a page: the content width by 48, one per screen, the page's one act (Art. 7.9).
export function FootButton({ id, label, kind = 'primary', icon, state = 'idle', step, onPress }: {
  id: string;
  label: string;
  kind?: PillKind;
  icon?: IconName;
  state?: PillState;
  step?: string;
  onPress?: () => void;
}) {
  return (
    <Press id={id} onPress={onPress} disabled={state !== 'idle'}>
      {({ pressed }) => <FootBody {...{ label, kind, icon, state, step, pressed }} />}
    </Press>
  );
}
function FootBody({ label, kind, icon, state, step, pressed }: { label: string; kind: PillKind; icon?: IconName; state: PillState; step?: string; pressed: boolean }) {
  const f = useFill(kind, pressed, state);
  return (
    <View {...mark('button', { kind, state })} style={[{ height: size.buttonH, width: '100%', borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, f.box]}>
      <Label label={label} step={step} tone={f.tone} state={state} icon={icon} />
    </View>
  );
}
