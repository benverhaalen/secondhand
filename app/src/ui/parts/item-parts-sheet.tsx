// The parts sheet's row for the parts the item page added (app/src/app/dev/parts.tsx shows it): the photo pager, the
// chips with Something else, the switch, the listing preview and the question card, each in every state. The route sheet
// is a whole-screen part, so it is seen on /item/it_switch/plan and in the render check, not here.
import { useState } from 'react';
import { Section, Stack } from '../layout';
import { Txt } from '../text';
import { Chips } from './chips';
import { Blank } from './loop';
import { ListingPreview } from './listing-preview';
import { PhotoPager } from './photo-pager';
import { QuestionCard } from './question-card';
import { Switch } from './switch';

export function ItemParts() {
  const [pick, setPick] = useState<string | null>('92');
  const [typed, setTyped] = useState<string | undefined>();
  const [on, setOn] = useState(true);
  return (
    <Section title="Photo pager, chips, switch, listing preview, question card">
      <PhotoPager photos={['carhartt-jacket', 'patagonia-fleece', 'brass-lamp']} label="Three photos" />
      <PhotoPager photos={['kindle']} label="One photo" />
      <Stack gap="tight">
        <Txt role="caption">Counter: three amounts, the middle picked, then Something else</Txt>
        <Chips id="c-counter" name="Counter" value={pick} other={{ numeric: true, typed }}
          options={[{ id: '88', label: '$88' }, { id: '92', label: '$92' }, { id: '95', label: '$95' }]}
          onChange={(v, t) => { setPick(v); if (t) setTyped(v); }} />
      </Stack>
      <Stack gap="tight">
        <Txt role="caption">On, off, disabled</Txt>
        <Stack gap="tight">
          <Switch id="sw-on" label="Price drops" on={on} onChange={setOn} />
          <Switch id="sw-off" label="Post here, off" on={false} />
          <Switch id="sw-disabled" label="Post here, unavailable" on={false} disabled />
        </Stack>
      </Stack>
      <ListingPreview site="ebay" photo="switch-oled" title="Nintendo Switch OLED, white, with dock, HEG-001, 64 GB" price={23500} keep={20262} photos="1 photo, square"
        audience="Searched by model: specs in the title"
        needs={<Blank id="lp-blank" name="Joy-Con drift" look="body" />} toggle={<Switch id="lp-on" label="Post here" on />} />
      <ListingPreview site="facebook" photo="switch-oled" title="Nintendo Switch OLED, white, with dock" price={22500} keep={20250} photos="1 photo, square"
        audience="Nearby, picks up today: pickup price"
        toggle={<Switch id="lp-off" label="Post here, off" on={false} />} off />
      <QuestionCard id="q-drift" where="Step 4 of 9: Facts a camera can’t see" question="Do the Joy-Cons drift?"
        options={[{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }, { id: 'dk', label: 'I don’t know' }]} pick={null} onAnswer={() => {}} />
      <QuestionCard id="q-done" where="7 of 9 steps done. Ready to plan" question={null} />
    </Section>
  );
}
