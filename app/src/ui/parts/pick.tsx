// A guess among a few named choices. Why a part: Guess edits words in place, but much of what an agent guesses is one
// of a few (what happens to a thing, what happens to what is left, which hours to add), and typing those would invite
// a wrong answer. It reads exactly like Guess: a dotted underline while it is the agent's pick, solid once the person
// picks (Ben, 04:04, human in the loop; ui-build README, the hand-off rule). A tap opens a sheet that names each choice
// and what it does, with a tick on the one in force.
//   GuessPick  the underlined words, and the sheet they open.
//   Choices    the rows of such a sheet, for a screen that opens its own (a tile that asks what happens to the thing).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors, useGround } from '../theme';
import { size, space } from '../tokens.generated';
import { mark } from './mark';
import { Sheet } from './overlays';

export type Choice = { id: string; label: string; does?: string };

export function GuessPick({ id, name, value, choices, onPick, look = 'body', changed, lead }: {
  id: string;
  // What is being chosen, as the sheet's title: "What’s left Thursday".
  name: string;
  // The id of the choice in force.
  value: string;
  choices: Choice[];
  onPick?: (id: string) => void;
  look?: 'headline' | 'body';
  // True once the person has picked: the screen keeps this, since it is the person's answer.
  changed?: boolean;
  // The word that says what the choice is, when it is an amount ("For" $225): it sits in the same box, not underlined,
  // so the amount is never read without it (C6, render check B12).
  lead?: string;
}) {
  const c = useColors(), ground = useGround();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(!!changed);
  const now = choices.find(x => x.id === value) ?? choices[0];
  const theirs = mine || changed;
  const ink = ground === 'field' ? c.onField : c.ink;
  const line = theirs ? { borderBottomWidth: 1, borderStyle: 'solid' as const, borderColor: ink } : { borderBottomWidth: 1.5, borderStyle: 'dotted' as const, borderColor: ground === 'field' ? c.onField2 : c.ink2 };
  return (
    // The lead word is under the same line as the amount: the line is the button's whole shape (render check U1, a button
    // is a filled or outlined shape), and the amount is never read without its word (C6, B12). It is a wider target too.
    <View {...mark('guess', { by: theirs ? 'person' : 'agent', kind: 'pick', fit: 'content' })} style={{ alignSelf: 'flex-start' }}>
      <Press id={id} label={`${name}: ${lead ? `${lead} ` : ''}${now.label}`} onPress={() => setOpen(true)} round={false} hit={{ top: 12, bottom: 12, left: 4, right: 4 }}>
        <View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: space.s1 }, line]}>
          {lead ? <Txt role={look} tone="ink-2">{lead}</Txt> : null}
          <Txt role={look}>{now.label}</Txt>
        </View>
      </Press>
      <Sheet open={open} title={name} onClose={() => setOpen(false)}>
        <Choices id={id} choices={choices} value={now.id} onPick={next => { setOpen(false); setMine(true); if (next !== now.id) onPick?.(next); }} />
      </Sheet>
    </View>
  );
}

// One row per choice: its words, what it does in secondary ink, and a tick on the one in force. Rows of one kind take a
// hairline between them (README, Which separator means what). Each row's id is `${id}-${choice.id}` for tests.
export function Choices({ id, choices, value, onPick }: { id: string; choices: Choice[]; value: string; onPick: (id: string) => void }) {
  const c = useColors();
  return (
    <View {...mark('choices')}>
      {choices.map((x, i) => (
        <Press key={x.id} id={`${id}-${x.id}`} label={x.label} selected={x.id === value} onPress={() => onPick(x.id)} round={false}>
          <View style={{ minHeight: size.noticeH, paddingVertical: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s3,
            borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.rule }}>
            <View style={{ flex: 1, gap: space.s1 }}>
              {/* The space ends the label as a word, so the row's text reads "$95 You keep", not "$95You keep", when it is copied or matched. */}
              <Txt role="body">{x.does ? `${x.label} ` : x.label}</Txt>
              {x.does ? <Txt role="caption" tone="ink-2">{x.does}</Txt> : null}
            </View>
            {x.id === value ? <Icon name="tick-02" size={20} /> : <View style={{ width: 20 }} />}
          </View>
        </Press>
      ))}
    </View>
  );
}
