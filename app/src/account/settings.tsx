import { Share } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { Approve, FootButton, List, Nav, Screen, Section, Sheet, Stack, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { accountError, useSession } from './session';

export function AccountSettings({ embedded = false }: { embedded?: boolean }) {
  const session = useSession();
  const [sheet, setSheet] = useState<'signout' | 'export' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [exportData, setExportData] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<string | null>(null);
  const [exportState, setExportState] = useState<string | null>(null);
  const signOut = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await session.signOut(); setSheet(null); router.replace('/onboarding'); }
    catch (failure) { log.error('account.signout', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  };
  const requestExport = async () => {
    if (busy) return;
    setSheet('export'); setBusy(true); setError(null);
    try {
      const job = await api.call<{ id: string; state: string; reason?: string }>('POST /v1/me/export');
      if (job.state === 'done') { const result = await api.call<{ result: unknown }>(`GET /v1/jobs/${encodeURIComponent(job.id)}`); setExportData(JSON.stringify(result.result, null, 2)); }
      setExportState(job.state === 'done' ? 'Your export is ready.' : job.reason ? 'The export service is not ready yet.' : 'Your export is being prepared.');
    } catch (failure) { log.error('account.export', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  };
  const deleteAccount = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const job = await api.call<{ state: string; reason?: string }>('DELETE /v1/me');
      if (job.state === 'done') { await api.signOut(); await session.reload(); router.replace('/onboarding'); }
      else setDeleteState(job.reason ? 'Account deletion needs service setup before it can finish.' : 'Account deletion is in progress.');
    } catch (failure) { log.error('account.delete', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  };
  const content = <Stack gap="cards">
    <List>
      <ListRow id="settings-services" lead="link-01" label="Connected services" detail="Connect or manage your marketplace accounts" onPress={() => router.push('/you/connections')} />
      <ListRow id="settings-notifications" lead="inbox" label="Notifications" detail="All updates arrive in Messages" onPress={() => router.push('/messages')} />
      <ListRow id="settings-defaults" label="App defaults" onPress={() => router.push('/you/defaults')} />
      <ListRow id="settings-permissions" label="Permissions" onPress={() => router.push('/you/permissions')} />
      <ListRow id="settings-records" label="Records" onPress={() => router.push('/you/records')} />
      <ListRow id="pause-row" label="Pause selling" detail="Not available until service controls are connected." />
    </List>
    <Section title="Account"><List>
      <ListRow id="signin-row" label="Signed in with" value={session.user?.auth_methods.map(method => method.provider === 'email' ? 'Email' : method.provider).join(', ')} />
      <ListRow id="export-row" label="Export your data" onPress={requestExport} />
      <ListRow id="signout-row" label="Sign out" onPress={() => { setError(null); setSheet('signout'); }} />
      <ListRow id="delete-row" label="Delete account" tone="brick" onPress={() => { setError(null); setSheet('delete'); }} />
    </List></Section>
    <Sheet open={sheet === 'signout'} title="Sign out" onClose={() => { if (!busy) setSheet(null); }}>
      <Txt role="body">This signs you out of Secondhand on this device.</Txt>
      {error ? <Txt role="body">{error}</Txt> : null}
      <Approve id="signout-confirm" does="Sign out" status={busy ? 'working' : 'ready'} step="Signing out" onApprove={signOut} />
    </Sheet>
    <Sheet open={sheet === 'delete'} title="Delete account" onClose={() => { if (!busy) setSheet(null); }}>
      <Txt role="body">Delete your Secondhand account and data. This cannot be undone.</Txt>
      {error || deleteState ? <Txt role="body">{error ?? deleteState}</Txt> : null}
      {!deleteState ? <Approve id="delete-confirm" does="Delete account" status={busy ? 'working' : 'ready'} step="Deleting" onApprove={deleteAccount} /> : null}
    </Sheet>
    <Sheet open={sheet === 'export'} title="Your data" onClose={() => setSheet(null)}>
      <Txt role="body">{error ?? exportState ?? 'Preparing your export…'}</Txt>
      {exportData ? <FootButton id="export-share" label="Share export" onPress={() => { void Share.share({ message: exportData }).catch(failure => setError(accountError(failure))); }} /> : null}
      {error ? <FootButton id="export-retry" label="Try again" onPress={requestExport} /> : null}
    </Sheet>
  </Stack>;
  return embedded ? content : <Screen name="you-settings" state={busy ? 'loading' : error ? 'failed' : 'typical'} nav={<Nav back={() => router.back()} />}>
    <Txt role="heading">Settings</Txt>{content}
  </Screen>;
}
