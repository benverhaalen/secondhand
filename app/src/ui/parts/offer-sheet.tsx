// Making an offer to a seller (pages §6.14; spec/features/buy.md: `buy_offer`, ask every time, never promotable).
// Why a part: an offer starts from a listing and from the Buy tab's waiting card, and both must ask the same way.
// It is a hand-off (.agents/ui-build/README.md): money leaves the person's limits, so nothing is sent until the tap.
// Three amounts, picked before the sheet opens (the screen works them out from the price and the fair range), then
// "Something else", which opens a blank amount field; the act says exactly what it sends, with the one sentence a
// money step keeps (copy.md, Safety copy): who pays, and where. The sheet rises from the button that opened it.
import { useEffect, useState } from 'react';
import { Txt } from '../text';
import { Blank, Approve } from './loop';
import { FootButton } from './buttons';
import { Choice } from './chip';
import { money } from './mark';
import { Sheet } from './overlays';
import { List, Stack } from '../layout';

export function OfferSheet({ id, open, amounts, notes = {}, pick, status = 'ready', problem, onSend, onClose }: {
  id: string;
  open: boolean;
  // Three amounts in the person's currency units, lowest first.
  amounts: number[];
  // A note beside an amount, by amount: { 80: 'Your most' }.
  notes?: Record<number, string>;
  // The amount chosen when the sheet opens: the agent's guess, if it made one.
  pick?: number;
  status?: 'ready' | 'working' | 'failed';
  // Why an amount can't be sent, from the screen's rule ('Over their price of $64'), or null. The button says it, disabled.
  problem?: (amount: number | null) => string | null;
  onSend: (amount: number) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(pick != null ? String(pick) : null);
  const [other, setOther] = useState('');
  useEffect(() => { if (open) { setChosen(pick != null ? String(pick) : null); setOther(''); } }, [open, pick]);
  const typed = Number(other.replace(/[^0-9.]/g, ''));
  const amount = chosen === 'other' ? (typed > 0 ? typed : null) : chosen != null ? Number(chosen) : null;
  return (
    <Sheet open={open} title="Offer" onClose={onClose}>
      <List>
        {[...amounts.map(a => ({ id: String(a), label: money(a), line: notes[a] })), { id: 'other', label: 'Something else', line: undefined }].map(o => (
          <Choice key={o.id} id={`${id}-amount-${o.id}`} label={o.label} line={o.line} picked={chosen === o.id} onPress={() => setChosen(o.id)} />
        ))}
      </List>
      {chosen === 'other' ? <Blank id={`${id}-other`} name="Amount" value={other} onChange={setOther} numeric /> : null}
      <Stack gap="tight">
        {amount != null && !problem?.(amount) ? (
          <Approve id={`${id}-send`} does={`Send a ${money(amount)} offer`} status={status} step="Sending" failed="The site did not answer. Nothing was sent."
            onApprove={() => onSend(amount)} />
        ) : <FootButton id={`${id}-send`} label={problem?.(amount) ?? 'Pick an amount'} state="disabled" />}
        <Txt role="caption">If they accept, you pay on the site.</Txt>
      </Stack>
    </Sheet>
  );
}
