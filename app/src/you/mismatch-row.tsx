// One thing where a site and our record disagree: the thing, what differs, and Open on the site under it at full width of the
// text, so neither the title nor what differs is cut to make room for the button (Your sites and a site's own page).
import type { Site } from '@/demo';
import { openMarketplace } from '@/navigation/open-marketplace';
import { Line, Pill, Stack } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import type { AuditRow } from './site-audit';

export function MismatchRow({ row, site }: { row: AuditRow; site?: Site }) {
  const url = row.url;
  return (
    <Stack gap="tight">
      <ListRow id={row.id} site={site} lead={site ? undefined : 'alert-02'} tone="brick" label={row.label} detail={row.detail} />
      {url ? (
        <Line>
          <Pill id={`open-${row.id}`} kind="second" label="Open on the site" onPress={() => { void openMarketplace(url); }} />
        </Line>
      ) : null}
    </Stack>
  );
}
