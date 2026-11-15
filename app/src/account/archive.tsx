import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { useLiveData } from '@/data/live';
import { FootButton, List, Nav, Pill, Screen, Stack, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { useColors } from '@/ui/theme';
import { space, type, weight } from '@/ui/tokens.generated';
import { FACE } from '@/ui/fonts';
import { accountError } from './session';

type Listing = { external_id: string; title?: string; photo_url?: string; state: string; price_cents: { amount_cents: number; currency: string }; matches_item_id?: string };
type Preview = { site: string; username?: string; needs_username?: boolean; listings: Listing[] };
type Job = { id: string; state: string; result?: { item_ids?: string[] }; error?: { message?: string } };

export function Archive({ accountId }: { accountId: string }) {
  const c = useColors(), live = useLiveData();
  const [preview, setPreview] = useState<Preview | null>(null), [username, setUsername] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null), [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (handle?: string) => {
    setBusy(true); setError(null);
    try {
      const data = await api.call<Preview>(`GET /v1/accounts/${encodeURIComponent(accountId)}/import-preview${handle ? `?username=${encodeURIComponent(handle)}` : ''}`);
      setPreview(data); setSelected(new Set(data.listings.filter(row => !row.matches_item_id).map(row => row.external_id)));
    } catch (failure) { log.error('archive.preview', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  }, [accountId]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  const follow = async (current: Job) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    await api.jobFrames(current.id, { signal: abort.signal, onFrame: frame => {
      if (frame.event === 'stage' && typeof frame.data.stage === 'string') setProgress(frame.data.stage);
      if (frame.event === 'job' && typeof frame.data.state === 'string') setProgress(frame.data.state);
    } });
    const result = await api.call<Job>(`GET /v1/jobs/${encodeURIComponent(current.id)}`);
    setJob(result);
    if (result.state === 'failed') throw new Error(result.error?.message ?? 'The import failed. Your existing items are still saved.');
    if (result.state === 'done') { await live.refresh(); await load(); }
  };
  const importSelected = async () => {
    if (busy || !selected.size) return;
    setBusy(true); setError(null); setProgress('Queued');
    try {
      const current = await api.call<Job>(`POST /v1/accounts/${encodeURIComponent(accountId)}/import`, { body: { listings: true, purchases: false, external_ids: [...selected] } });
      setJob(current); await follow(current);
    } catch (failure) { log.error('archive.import', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  };
  const resume = async () => {
    if (!job || busy) return;
    setBusy(true); setError(null);
    try { await follow(job); } catch (failure) { setError(accountError(failure)); } finally { setBusy(false); }
  };
  return <Screen name="archive-import" state={busy ? 'loading' : error ? 'failed' : 'ready'} nav={<Nav inbox={{ count: 0 }} />}
    onRefresh={busy ? undefined : () => load()}
    foot={preview && !preview.needs_username ? <FootButton id="archive-import" label={`Import ${selected.size} items`} state={busy ? 'working' : selected.size ? 'idle' : 'disabled'} onPress={importSelected} /> : undefined}>
    <Stack gap="tight"><Txt role="heading">Import your archive</Txt><Txt role="body" tone="ink-2">Bring listings into your Secondhand account. Choose where to publish them later.</Txt></Stack>
    {preview?.needs_username ? <Stack>
      <Txt role="body">Enter the Depop shop to import. This selects a public shop; it does not verify that you own it.</Txt>
      <TextInput accessibilityLabel="Depop username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
        editable={!busy} onSubmitEditing={() => { if (username.trim()) void load(username.trim()); }} placeholder="Depop username" placeholderTextColor={c.ink2}
        style={{ ...type.t18, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink, paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: c.rule }} />
      <FootButton id="archive-preview" label="Preview archive" state={busy ? 'working' : username.trim() ? 'idle' : 'disabled'} onPress={() => load(username.trim())} />
    </Stack> : null}
    {busy ? <Txt role="body">{job ? `Import ${progress || 'in progress'}…` : 'Reading your listings…'}</Txt> : null}
    {job?.state === 'done' ? <Txt role="body">Imported {job.result?.item_ids?.length ?? 0} items.</Txt> : null}
    {preview && !preview.needs_username ? <Stack>
      <Txt role="caption">{preview.username ? `@${preview.username} · ` : ''}{preview.listings.length} listings</Txt>
      <Pill id="archive-select-all" kind="second" label={selected.size === preview.listings.length ? 'Clear selection' : 'Select all'} state={busy ? 'disabled' : 'idle'} onPress={() => setSelected(selected.size === preview.listings.length ? new Set() : new Set(preview.listings.map(row => row.external_id)))} />
      {!preview.listings.length ? <Txt role="body">No listings were returned by this service.</Txt> : null}
      <List>{preview.listings.map(row => <ListRow key={row.external_id} id={`archive-${row.external_id}`} photo={row.photo_url ?? null}
        label={row.title || `Listing ${row.external_id}`} detail={`${row.state}${row.matches_item_id ? ' · Already imported' : ''}`}
        value={`${row.price_cents.currency} ${(row.price_cents.amount_cents / 100).toFixed(2)}`}
        trail={<Pill id={`select-${row.external_id}`} label={selected.has(row.external_id) ? 'Selected' : 'Select'} kind="second" state={busy ? 'disabled' : 'idle'} onPress={() => setSelected(prior => { const next = new Set(prior); if (next.has(row.external_id)) next.delete(row.external_id); else next.add(row.external_id); return next; })} />} />)}</List>
    </Stack> : null}
    {error ? <Stack><Txt role="body">{error}</Txt><Pill id="archive-retry" kind="second" label={job && !['done', 'failed'].includes(job.state) ? 'Check import' : 'Try again'} onPress={job && !['done', 'failed'].includes(job.state) ? resume : () => load(username.trim())} /></Stack> : null}
    <Pill id="archive-back" kind="second" label="Back" onPress={() => router.back()} />
  </Screen>;
}
