// Human in the loop, the product's signature (Ben, 04:04: "design around human in the loop to show it off as central to our product").
// Every page shows what the agent guessed and lets the person change it, calmly, not as a warning:
//   Guess    text the agent guessed. A dotted underline until the person changes or confirms it, then solid: theirs now.
//   Blank    a field nobody knows yet. A solid underline under the name of what is missing.
//   Approve  one tap, and the button says exactly what it will do. Price, an address and a pickup always wait for it.
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FACE } from '../fonts';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors, useGround } from '../theme';
import { size, space, type, weight } from '../tokens.generated';
import { FootButton } from './buttons';
import { mark } from './mark';

type Field = {
  id: string;
  // What the field is, for a screen reader and for the log: "Size", "Price".
  name: string;
  value: string;
  onChange?: (next: string) => void;
  // headline: the text you type, 18 (Art. 6 roles). body: inside a sentence or a row, 15.
  look?: 'headline' | 'body';
  // A number pad for an amount.
  numeric?: boolean;
};

function Editable({ id, name, value, onChange, look = 'headline', numeric, line, placeholder }: Field & { line: 'dotted' | 'solid'; placeholder?: string }) {
  const c = useColors(), ground = useGround();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const t = look === 'headline' ? type.t18 : type.t15;
  const ink = ground === 'field' ? c.onField : c.ink;
  const underline = { borderBottomWidth: line === 'dotted' ? 1.5 : 1, borderStyle: line, borderColor: line === 'dotted' ? (ground === 'field' ? c.onField2 : c.ink2) : ink } as const;
  // A dotted guess the person opens and leaves as it is was still looked at: that confirms it, so it commits too.
  const commit = () => { setEditing(false); if (draft !== value || line === 'dotted') onChange?.(draft); };
  if (editing) {
    return (
      <View style={[{ alignSelf: 'flex-start', minWidth: 88 }, { borderBottomWidth: 1.5, borderColor: ink }]}>
        <TextInput
          testID={`${id}-input`}
          accessibilityLabel={name}
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          selectTextOnFocus
          // Inputs are at least 16, so iOS never zooms (frontend-standard §5); the text you type is 18.
          style={{ fontSize: Math.max(16, t.fontSize), lineHeight: t.lineHeight, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: ink, padding: 0, outlineStyle: 'none' } as object}
        />
      </View>
    );
  }
  return (
    <Press id={id} label={`${name}: ${value || placeholder || 'empty'}`} onPress={() => { setDraft(value); setEditing(true); }} round={false} hit={{ top: 12, bottom: 12, left: 4, right: 4 }}>
      <View style={[{ alignSelf: 'flex-start', paddingBottom: 0 }, underline]}>
        <Txt role={look} tone={value ? 'ink' : 'ink-2'}>{value || placeholder}</Txt>
      </View>
    </Press>
  );
}

// What the agent guessed. It stays dotted until the person changes it or opens it and leaves it (that confirms it), then it
// is solid. Tapping it edits it in place.
export function Guess({ id, name, value, onChange, look, numeric, changed }: Field & {
  // True once the person has changed it: the screen keeps this, since it is the person's answer.
  changed?: boolean;
}) {
  const [mine, setMine] = useState(!!changed);
  return (
    <View {...mark('guess', { by: mine || changed ? 'person' : 'agent', fit: 'content' })} style={{ alignSelf: 'flex-start' }}>
      <Editable id={id} name={name} value={value} look={look} numeric={numeric} line={mine || changed ? 'solid' : 'dotted'}
        onChange={v => { setMine(true); onChange?.(v); }} />
    </View>
  );
}

// A field nobody knows yet. It shows the name of what is missing on a solid line, so the gap is plain to see and quick to fill.
export function Blank({ id, name, value = '', onChange, look, numeric }: Omit<Field, 'value'> & { value?: string }) {
  return (
    <View {...mark('blank', { filled: value ? 'true' : 'false', fit: 'content' })} style={{ alignSelf: 'flex-start' }}>
      <Editable id={id} name={name} value={value} look={look} numeric={numeric} line="solid" placeholder={name} onChange={onChange} />
    </View>
  );
}

// One tap that does exactly what it says: "Post to eBay for $45", "Send my address to Sam". The content width by 48.
// ready: waiting. working: the button says the step. done: it says what happened, with Undo beside it while it can be undone.
// failed: it stays, says what failed, and the tap tries again.
export function Approve({ id, does, status = 'ready', step, done, failed, onApprove, onUndo }: {
  id: string;
  does: string;
  status?: 'ready' | 'working' | 'done' | 'failed';
  step?: string;
  // What happened, in the past tense: "Posted to eBay".
  done?: string;
  // What failed: "eBay did not answer".
  failed?: string;
  onApprove?: () => void;
  onUndo?: () => void;
}) {
  if (status === 'done') {
    return (
      <View {...mark('approve', { status })} style={{ height: size.buttonH, flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <Icon name="checkmark-circle-02" />
        <View style={{ flex: 1 }}><Txt role="body" lines={1}>{done ?? 'Done'}</Txt></View>
        {onUndo ? <UndoLink id={`${id}-undo`} onPress={onUndo} /> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: space.s2 }}>
      <FootButton id={id} label={status === 'failed' ? 'Try again' : does} icon={status === 'failed' ? 'refresh' : undefined}
        state={status === 'working' ? 'working' : 'idle'} step={step} onPress={onApprove} />
      {status === 'failed' && failed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
          <Icon name="alert-02" size={12} tone="brick" />
          <Txt role="caption" tone="ink-2">{failed}</Txt>
        </View>
      ) : null}
    </View>
  );
}

function UndoLink({ id, onPress }: { id: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Press id={id} label="Undo" onPress={onPress}>
      {({ pressed }) => (
        <View style={{ height: size.pillCardH, paddingHorizontal: size.pillCardPad, borderRadius: 999, backgroundColor: pressed ? c.grayPress : c.gray, alignItems: 'center', justifyContent: 'center' }}>
          <Txt role="body">Undo</Txt>
        </View>
      )}
    </Press>
  );
}
