// Why? on a number (pages.md §6.6: "Why? on any field or number"). Ben, 06:53: "the user should in plain language be able
// to understand the reasoning and can then see numbers if need be". Why a part: the item's price range, its fees and the
// Plan's price rule all answer Why the same way, so a person learns it once: the reason in words first, and the numbers a
// tap under it, never the arithmetic before the reason. It is the sheet a Why? opens: its title, the reason, See the
// numbers (a row that leads, as on You > Defaults), then the rows the screen hands it and where they come from, then
// anything the screen adds under them (the item's events with Undo). Done closes it, and it opens on the reason again.
// States: the reason alone; the reason with the numbers open.
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '../text';
import { space } from '../tokens.generated';
import { FootButton } from './buttons';
import { Choice } from './chip';
import { mark } from './mark';
import { Sheet } from './overlays';

export function WhySheet({ id, open, title, says, numbers, basis, onClose, children }: {
  id: string;
  open: boolean;
  // What is being explained: "Why $85 to $115", "Same take-home".
  title: string;
  // The reason in plain words, one or two sentences.
  says: string;
  // The rows behind the reason: a List of KeepRow or Row, shown only after See the numbers.
  numbers: ReactNode;
  // Where the numbers come from and how fresh they are: "Checked today".
  basis?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const close = () => { setShown(false); onClose(); };
  return (
    <Sheet open={open} title={title} onClose={close}>
      <View {...mark('why', { numbers: shown ? 'shown' : 'hidden' })} style={{ gap: space.s4 }}>
        <Txt role="body">{says}</Txt>
        {shown ? (
          <View style={{ gap: space.s2 }}>
            {numbers}
            {basis ? <Txt role="caption">{basis}</Txt> : null}
          </View>
        ) : <Choice id={`${id}-numbers`} label="See the numbers" leads onPress={() => setShown(true)} />}
        {children}
        <FootButton id={`${id}-done`} kind="second" label="Done" onPress={close} />
      </View>
    </Sheet>
  );
}
