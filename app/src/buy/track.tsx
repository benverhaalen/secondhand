import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { captureMessage } from '@/capture/client';
import { ALL_SITES, CUTS, sizesFor } from './read';
import { Blank, ChoiceChips, FootButton, Nav, Screen, Section, SizePicker, Stack, Txt, log } from '@/ui';

type Tracked = {
  id: string; version: number; text: string; state: 'active' | 'paused' | 'ended';
  max_total_cents: { amount_cents: number; currency: string }; sites: string[]; alert: 'under' | 'available';
  fit?: { size?: string; cut?: string; color?: string; min_total_cents?: number; description?: string; dimensions?: string; handover?: string };
};
const kindOf = (text: string) => /\b(shoes?|sneakers?|boots?|dunks?|jordans?)\b/i.test(text) ? 'shoes'
  : /\b(jersey|shirt|tee|jacket|hoodie|sweater|dress|jeans|coat|uniform)\b/i.test(text) ? 'apparel'
  : /\b(couch|sofa|chair|table|desk|bed|dresser|shelf|furniture)\b/i.test(text) ? 'furniture' : 'other';
const money = (text: string) => /^\d+(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text) * 100) : null;

export function TrackItem({ id, query = '' }: { id?: string; query?: string }) {
  const [saved, setSaved] = useState<Tracked | null>(null);
  const [text, setText] = useState(query);
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState<string | null>(null);
  const [system, setSystem] = useState('letter');
  const [cut, setCut] = useState('any');
  const [dimensions, setDimensions] = useState('');
  const [description, setDescription] = useState('');
  const [handover, setHandover] = useState('either');
  const [busy, setBusy] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const kind = kindOf(text);
  const sizes = sizesFor(kind === 'apparel' || kind === 'shoes' ? kind : null);
  const min = low.trim() ? money(low) : 0, max = money(high);
  const valid = text.trim().length > 0 && min !== null && max !== null && max >= min;

  useEffect(() => {
    if (!id) return;
    let current = true;
    api.call<Tracked>(`GET /v1/wants/${encodeURIComponent(id)}`).then(want => {
      if (!current) return;
      setSaved(want); setText(want.text); setHigh(String(want.max_total_cents.amount_cents / 100));
      setLow(want.fit?.min_total_cents === undefined ? '' : String(want.fit.min_total_cents / 100));
      setColor(want.fit?.color ?? ''); setSize(want.fit?.size ?? null); setCut(want.fit?.cut ?? 'any');
      setDescription(want.fit?.description ?? ''); setDimensions(want.fit?.dimensions ?? ''); setHandover(want.fit?.handover ?? 'either');
    }).catch(failure => { log.error('track.read', failure); if (current) setError(captureMessage(failure)); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [id]);

  const save = async (state?: Tracked['state']) => {
    if (busy || !valid) return;
    setBusy(true); setError(null); setNotice(null);
    const fit = { min_total_cents: min!, ...(color.trim() ? { color: color.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}),
      ...(kind === 'furniture' && dimensions.trim() ? { dimensions: dimensions.trim() } : {}),
      ...(sizes.length && size ? { size } : {}), ...(kind === 'apparel' && cut !== 'any' ? { cut } : {}), handover };
    const body = { text: text.trim(), fit, max_total_cents: { amount_cents: max!, currency: 'USD' }, sites: saved?.sites ?? ALL_SITES, alert: 'under' as const };
    try {
      if (saved) {
        const result = await api.call<Pick<Tracked, 'id' | 'version' | 'state'>>(`PATCH /v1/wants/${encodeURIComponent(saved.id)}`, { body: { ...body, version: saved.version, ...(state ? { state } : {}) } });
        setSaved({ ...saved, ...body, ...result });
      } else setSaved(await api.call<Tracked>('POST /v1/wants', { body }));
      setNotice(state === 'paused' ? 'Tracking paused.' : state === 'ended' ? 'Tracking ended.' : 'Tracking saved.');
    } catch (failure) { log.error('track.save', failure); setError(captureMessage(failure)); }
    finally { setBusy(false); }
  };

  return <Screen name="want" state={busy ? 'loading' : error ? 'failed' : saved ? 'typical' : 'new'} nav={<Nav back={() => router.canGoBack() ? router.back() : router.replace('/buy' as Href)} />}
    foot={<Stack gap="tight">{error ? <Txt role="body">{error}</Txt> : null}<FootButton id="want-start" label={saved ? 'Save changes' : 'Track item'} state={busy ? 'working' : valid ? 'idle' : 'disabled'} step="Saving" onPress={() => save()} /></Stack>}>
    <Stack>
      <Txt role="heading">{saved ? 'Tracked item' : 'What do you want?'}</Txt>
      <Blank id="want-what" name="A Brewers jersey, a couch…" value={text} onChange={value => { setText(value); setNotice(null); }} />
    </Stack>
    {text.trim() ? <>
      <Section title="Price range">
        <Stack gap="tight">
          {low ? <Txt role="caption">Minimum</Txt> : null}
          <Blank id="want-min" name="Minimum, optional" value={low} numeric onChange={setLow} />
        </Stack>
        <Stack gap="tight">
          {high ? <Txt role="caption">Maximum, including delivery</Txt> : null}
          <Blank id="want-max" name="Maximum, including delivery" value={high} numeric onChange={setHigh} />
          {high && !valid && min !== null && max !== null && max < min ? <Txt role="caption">Maximum must be at least your minimum.</Txt> : null}
        </Stack>
      </Section>
      <Section>
        {sizes.length ? <Stack gap="tight"><Txt role="headline">Size</Txt><SizePicker id="want-size" systems={sizes} system={sizes.some(option => option.id === system) ? system : sizes[0].id} value={size} onChange={(next, value) => { setSystem(next); setSize(value); }} /></Stack> : null}
        {kind === 'apparel' ? <Stack gap="tight"><Txt role="headline">Fit</Txt><ChoiceChips id="want-cut" label="Fit" options={CUTS} value={cut} onChange={setCut} /></Stack> : null}
        <Stack gap="tight"><Txt role="headline">Does color matter?</Txt><Blank id="want-color" name="Any color" value={color} onChange={setColor} /></Stack>
        {kind === 'furniture' ? <Stack gap="tight"><Txt role="headline">Will it fit?</Txt><Blank id="want-dimensions" name="Dimensions or space available, optional" value={dimensions} onChange={setDimensions} /></Stack> : null}
      </Section>
      <Section title="How it gets to you"><ChoiceChips id="want-handover" label="Delivery" value={handover} options={[{ id: 'either', label: 'Either' }, { id: 'delivery', label: 'Shipping' }, { id: 'pickup', label: 'Pickup' }]} onChange={setHandover} /></Section>
      <Section title="Anything else?"><Blank id="want-description" name="Style, condition, details to match" value={description} onChange={setDescription} /></Section>
      <Txt role="caption" tone="ink-2">Finds and updates go to Messages.</Txt>
    </> : null}
    {notice ? <Txt role="body">{notice}</Txt> : null}
    {saved ? <Stack>
      <FootButton id="want-pause" kind="second" label={saved.state === 'paused' ? 'Resume tracking' : 'Pause tracking'} state={busy ? 'disabled' : 'idle'} onPress={() => save(saved.state === 'paused' ? 'active' : 'paused')} />
      <FootButton id="want-messages" kind="second" label="Open messages" onPress={() => router.push('/messages' as Href)} />
    </Stack> : null}
  </Screen>;
}
