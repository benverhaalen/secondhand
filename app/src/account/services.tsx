import { useCallback, useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, ApiFailure } from '@/api/client';
import { origin } from '@/api/origin';
import type { Site } from '@/demo';
import { FootButton, Line, List, Pill, Sheet, Stack, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { accountError } from './session';

type Service = { site: Site; available: boolean; reason?: string; account?: { id: string; state: string } };
type Pending = { site: Site; handle: string; account_id: string };
export function Services({ onChanged }: { onChanged?: () => void } = {}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState<Site | null>(null);
  const [disconnect, setDisconnect] = useState<Service | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setServices((await api.call<{ services: Service[] }>('GET /v1/connections')).services); }
    catch (failure) { log.error('connections.read', failure); setError(accountError(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const check = async (current = pending) => {
    if (!current) return;
    setBusy(current.site); setError(null);
    try {
      const result = await api.call<{ state: string; reason?: string }>(`POST /v1/connections/${encodeURIComponent(current.handle)}/complete`);
      if (result.state === 'linked' || result.state === 'ok') {
        setPending(null); setNotice('Connected.'); await load(); onChanged?.();
      } else if (result.state === 'waiting') {
        setNotice('You are still on the sign-in page. Open it again to finish, then tap Done.');
      } else { setPending(null); await load(); setError(result.reason ?? 'The connection was not completed. Try connecting again.'); }
    } catch (failure) {
      setPending(null);
      try { await api.call(`DELETE /v1/connections/${encodeURIComponent(current.handle)}`); } catch { /* The server expires any unconfirmed connection. */ }
      log.error('connections.complete', failure); setError(accountError(failure));
      await load(); // a link that finished before the answer was lost shows as Connected
    }
    finally { setBusy(null); }
  };
  const connect = async (site: Site) => {
    if (busy || pending) return;
    setBusy(site); setError(null); setNotice(null);
    let current: Pending | undefined;
    try {
      const result = await api.call<Omit<Pending, 'site'>>('POST /v1/connections', { body: { site } });
      current = { ...result, site }; setPending(current);
      await show(result.handle, current);
    } catch (failure) {
      log.error('connections.start', new Error('Service sign-in could not open')); setError(accountError(failure));
      // A sign-in that never opened is cancelled, so the next Connect is not refused as already running.
      setPending(null); api.call(`DELETE /v1/connections/${encodeURIComponent(current?.handle ?? '')}`).catch(() => {});
    }
    finally { setBusy(null); }
  };
  // Opens the service's page; closing it checks the sign-in, and a pending code keeps it open to reopen.
  const show = async (handle: string, current: Pending) => {
    const { url } = await api.call<{ url: string }>(`POST /v1/connections/${encodeURIComponent(handle)}/view`);
    if (!/^https:\/\//.test(url)) throw new Error('The sign-in page is unavailable');
    // Our frame fits the remote desktop window to the phone and centres it; the live URL goes in the fragment, never to a log.
    const browser = await WebBrowser.openBrowserAsync(`${origin.replace(/\/+$/, '')}/connect#${encodeURIComponent(url)}`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN, dismissButtonStyle: 'done' });
    if (browser.type === 'cancel' || browser.type === 'dismiss') await check(current);
  };
  const reopen = async () => {
    if (!pending || busy) return;
    setBusy(pending.site); setError(null);
    try { await show(pending.handle, pending); }
    catch (failure) { log.error('connections.reopen', failure); setError(accountError(failure)); }
    finally { setBusy(null); }
  };
  const cancel = async () => {
    if (!pending || busy) return;
    setBusy(pending.site); setError(null);
    try { await api.call(`DELETE /v1/connections/${encodeURIComponent(pending.handle)}`); setPending(null); setNotice(null); await load(); }
    catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 404) { setPending(null); setNotice(null); }
      else { log.error('connections.cancel', failure); setError(accountError(failure)); }
    }
    finally { setBusy(null); }
  };
  const unlink = async () => {
    if (!disconnect?.account || busy) return;
    setBusy(disconnect.site); setError(null);
    try { await api.call(`DELETE /v1/connections/accounts/${encodeURIComponent(disconnect.account.id)}`); setDisconnect(null); await load(); onChanged?.(); }
    catch (failure) { log.error('connections.unlink', failure); setError(accountError(failure)); }
    finally { setBusy(null); }
  };
  return <Stack>
    {loading && !services.length ? <Txt role="body">Loading services…</Txt> : null}
    <List>{services.map(service => {
      const linked = service.account?.state === 'linked';
      return <ListRow key={service.site} id={`service-${service.site}`} site={service.site}
        label={linked ? 'Connected' : service.available ? 'Not connected' : 'Unavailable'}
        detail={!service.available ? service.reason ?? 'Connection is not available yet.' : undefined}
        onPress={linked ? () => router.push(`/import/${service.account!.id}` as Href) : undefined}
        trail={linked ? <Pill id={`disconnect-${service.site}`} kind="second" label="Disconnect" onPress={() => setDisconnect(service)} /> : <Pill id={`link-${service.site}`} kind="second" label={service.account ? 'Reconnect' : 'Connect'}
          state={busy === service.site ? 'working' : !service.available || !!busy || !!pending ? 'disabled' : 'idle'} onPress={() => connect(service.site)} />} />;
    })}</List>
    {error ? <Txt role="body">{error}</Txt> : null}
    {notice && !pending ? <Txt role="body">{notice}</Txt> : null}
    <Line><Pill id="services-refresh" kind="second" label="Refresh connections" state={loading ? 'working' : 'idle'} onPress={load} /></Line>
    <Sheet open={!!disconnect} title="Disconnect service" onClose={() => { if (!busy) setDisconnect(null); }}>
      <Txt role="body">This removes Secondhand’s access. Your listings stay on the service.</Txt>
      {error ? <Txt role="body">{error}</Txt> : null}
      <FootButton id="connection-disconnect" label="Disconnect" state={busy ? 'working' : 'idle'} onPress={unlink} />
    </Sheet>
    <Sheet open={!!pending} title="Finish connecting" onClose={() => { void cancel(); }}>
      <Txt role="body">Sign in on the service’s page, then tap Done. Secondhand checks the connection before saving it.</Txt>
      {notice ? <Txt role="body">{notice}</Txt> : null}
      {error ? <Txt role="body">{error}</Txt> : null}
      <FootButton id="connection-reopen" label="Open sign-in" state={busy ? 'working' : 'idle'} onPress={reopen} />
      <FootButton id="connection-check" kind="second" label="Check connection" state={busy ? 'working' : 'idle'} onPress={() => check()} />
      <FootButton id="connection-cancel" kind="second" label="Cancel connection" state={busy ? 'disabled' : 'idle'} onPress={cancel} />
    </Sheet>
  </Stack>;
}
