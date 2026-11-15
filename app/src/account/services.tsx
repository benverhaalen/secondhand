import { useCallback, useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, ApiFailure } from '@/api/client';
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
        setNotice('Finish signing in on the service, then check again.');
      } else { setPending(null); await load(); setError(result.reason ?? 'The connection was not completed. Try connecting again.'); }
    } catch (failure) {
      setPending(null);
      try { await api.call(`DELETE /v1/connections/${encodeURIComponent(current.handle)}`); } catch { /* The server expires any unconfirmed connection. */ }
      log.error('connections.complete', failure); setError(accountError(failure));
    }
    finally { setBusy(null); }
  };
  const connect = async (site: Site) => {
    if (busy || pending) return;
    setBusy(site); setError(null); setNotice(null);
    try {
      const result = await api.call<Omit<Pending, 'site'>>('POST /v1/connections', { body: { site } });
      const current = { ...result, site }; setPending(current);
      const { url } = await api.call<{ url: string }>(`POST /v1/connections/${encodeURIComponent(result.handle)}/view`);
      if (!/^https:\/\//.test(url)) throw new Error('The sign-in page is unavailable');
      // ui=false hides the viewer's own tabs and toolbar so the service's page gets the screen (docs.browser-use.com, live preview).
      const view = new URL(url); view.searchParams.set('ui', 'false');
      const browser = await WebBrowser.openBrowserAsync(view.toString(), { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN, dismissButtonStyle: 'done' });
      if (browser.type === 'cancel' || browser.type === 'dismiss') await check(current);
    } catch (failure) { log.error('connections.start', new Error('Service sign-in could not open')); setError(accountError(failure)); }
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
      <FootButton id="connection-check" label="Check connection" state={busy ? 'working' : 'idle'} onPress={() => check()} />
      <FootButton id="connection-cancel" kind="second" label="Cancel connection" state={busy ? 'disabled' : 'idle'} onPress={cancel} />
    </Sheet>
  </Stack>;
}
