// A page under You (spec/pages.md §6.16): payouts, by site, records, your sites, rules and limits, activity, notifications, settings.
// One route, so a push or a link can open any of them directly; each page is its own file in app/src/you/.
// Behavior: app/behavior/you/[page].json.
import { useLocalSearchParams } from 'expo-router';
import { Nav, Screen, Txt } from '@/ui';
import { Activity } from '@/you/activity';
import { BySite } from '@/you/by-site';
import { Notifications } from '@/you/notifications';
import { Payouts } from '@/you/payouts';
import { Records } from '@/you/records';
import { Rules } from '@/you/rules';
import { Settings } from '@/you/settings';
import { Sites } from '@/you/sites';
import { isPage, skips, useGo } from '@/you/state';

const PAGE = { payouts: Payouts, insights: BySite, records: Records, connections: Sites, rules: Rules, log: Activity, notifications: Notifications, settings: Settings };

export default function YouPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const go = useGo();
  if (!isPage(page)) {
    return (
      <Screen name="you-page" state="empty" nav={<Nav back={() => go.back()} />} skip={skips('empty', { new: 'a page that does not exist is not found in every world' })}>
        <Txt role="heading">Not found</Txt>
      </Screen>
    );
  }
  const Page = PAGE[page];
  return <Page />;
}
