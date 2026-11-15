import { openMarketplace } from '@/navigation/open-marketplace';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ApiJobRow } from '@/edge/api/jobs';
import { FootButton, List, Photo, Section, Stack, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { captureMessage, readCapture, type Capture } from './client';

export type CaptureJob = Pick<ApiJobRow, 'id' | 'state'> & { kind: ApiJobRow['kind'] | 'studio' } & Partial<Pick<ApiJobRow, 'item_id' | 'result' | 'error' | 'stages'>>;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
const words = (value: string) => value.replaceAll('_', ' ');
const isWebLink = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//.test(value);

function JobResult({ job }: { job: CaptureJob }) {
  const result = record(job.result), range = record(result.range), basis = record(result.basis);
  const candidates = Array.isArray(result.candidates) ? result.candidates : Array.isArray(result.set) ? result.set : [];
  const [linkError, setLinkError] = useState<string | null>(null);
  const open = (url: string) => { setLinkError(null); openMarketplace(url).catch(error => { log.error('capture.open_match', error); setLinkError('The listing did not open. Try again.'); }); };
  if (job.kind === 'valuate') return <Stack>
    {typeof range.q10 === 'number' && typeof range.q90 === 'number' ? <Txt role="headline">{`${dollars(range.q10)} to ${dollars(range.q90)}`}</Txt> : <Txt role="body">There is not enough evidence to show an appraisal yet.</Txt>}
    <Section title="Why"><Txt role="body">{typeof basis.count === 'number' && basis.count > 0
      ? `Based on ${basis.count} comparable sales${typeof result.condition === 'string' ? ` in ${words(result.condition)} condition` : ''}.`
      : 'Comparable sales have not been returned.'}</Txt></Section>
  </Stack>;
  if (job.kind === 'identify') return <Stack>
    <List>{candidates.map((value, index) => {
      const candidate = record(value), url = candidate.url;
      return <ListRow key={String(candidate.product_id ?? index)} id={`capture-match-${index}`} label={typeof candidate.title === 'string' ? candidate.title : [candidate.brand, candidate.model].filter(value => typeof value === 'string').join(' ') || 'Identified item'}
        detail={isWebLink(url) ? 'Open listing' : 'Listing link not available'} onPress={isWebLink(url) ? () => open(url) : undefined} />;
    })}</List>
    {!candidates.length ? <Txt role="body">No matching items were returned.</Txt> : null}
    {linkError ? <Txt role="body">{linkError}</Txt> : null}
  </Stack>;
  if (job.kind === 'studio') {
    const photos = Array.isArray(result.photos) ? result.photos : [];
    return <Stack>{photos.map((value, index) => { const photo = record(value); return isWebLink(photo.url) ? <Photo key={index} src={photo.url} label="Prepared photo" /> : null; })}
      {!photos.length ? <Txt role="body">The service has not returned prepared photos.</Txt> : null}</Stack>;
  }
  return null;
}

export function CaptureResults({ capture, initial, photo }: { capture: Capture; initial: CaptureJob[]; photo: string | null }) {
  const [jobs, setJobs] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const update = (job: CaptureJob) => { if (!controller.signal.aborted) setJobs(all => all.map(previous => previous.id === job.id ? job : previous)); };
    const read = async (id: string) => {
      const job = await api.call<CaptureJob>(`GET /v1/jobs/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (job.item_id && job.item_id !== capture.item_id) throw new Error('The service returned a result for a different item.');
      update(job); return job;
    };
    initial.forEach(async initialJob => {
      try {
        const current = await read(initialJob.id);
        if (current.state !== 'done' && current.state !== 'failed') await api.jobFrames(current.id, { signal: controller.signal, onFrame: frame => {
          if (frame.event === 'job.state' && typeof frame.data.state === 'string') update({ ...current, state: frame.data.state as CaptureJob['state'] });
        } });
        if (!controller.signal.aborted) { await read(initialJob.id); await readCapture(capture.id); }
      } catch (error) {
        if (!controller.signal.aborted) { log.error('capture.result', error, { job: initialJob.id }); setErrors(all => ({ ...all, [initialJob.id]: captureMessage(error) })); }
      }
    });
    return () => controller.abort();
  }, [attempt, capture.id, capture.item_id, initial]);
  return <Stack>
    {photo ? <Photo src={photo} label="Your captured item" /> : null}
    {!jobs.length ? <Txt role="body">Your item was saved, but the service has not started processing it yet.</Txt> : null}
    {jobs.map(job => <Section key={job.id} title={job.kind === 'identify' ? 'Matches' : job.kind === 'valuate' ? 'Appraisal' : job.kind === 'studio' ? 'Photos' : words(job.kind)}>
      {errors[job.id] ? <Txt role="body">{errors[job.id]}</Txt> : job.state === 'failed' ? <Txt role="body">{job.error?.message ?? 'This step failed.'}</Txt> : job.state !== 'done' ? <Txt role="body">{job.state === 'queued' ? 'Waiting to start' : 'Working'}</Txt> : <JobResult job={job} />}
    </Section>)}
    <FootButton id="capture-results-refresh" kind="second" label="Refresh results" onPress={() => { setErrors({}); setAttempt(value => value + 1); }} />
  </Stack>;
}
