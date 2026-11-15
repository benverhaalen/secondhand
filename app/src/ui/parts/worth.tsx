// What a thing is worth, and what selling it keeps on each site (What's it worth, pages §6.11).
//
// Range: why it exists. A used thing's value is a range from what similar ones sold for, never one number (copy.md:
// "Similar ones sold for $36 to $52 lately"; appraise: every number a guarded number). Amount takes one number; this is
// the same 50 in the text face with what it is under it, holding "$70 to $95" as one piece of text (C6: one peak per
// view). A range too wide for one line breaks at a space, so never inside an amount. States: settled; rough (the Glance answer: the same size, its line says rough).
//
// KeepRow: why it exists. "What you'd keep on each site" is one row per site: the site's logo (never its name: C5), how
// long similar ones took to sell there, and what the person keeps after that site's fee, at the right edge where every
// marketplace row puts the amount (copy.md, Gestalt). A site with too few sales shows no number and says so, so nothing
// is ever guessed (appraise: "a route with no basis is hidden with its reason, never guessed"). States: a range, too few
// sales (no amount), checking (Glance: the site is still being read), and a note under it ("Not linked").
//
// SaleRow: why it exists. The value is only as good as the sales it goes by, and the person knows their thing better than
// a match does (Ben, 06:19: "investigate. Like human in the loop is very important"). One row per site's sales: the logo,
// what they sold for, and a check the person can take off when those sales are not the same thing. The range is then
// worked out again from the sales they kept. The whole row is the press, and it is one size ticked or not (U7).
// States: counted (a filled check), left out (an empty ring, the words in secondary ink), too few sales (no check).
import { View } from 'react-native';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark, type Site } from './mark';
import { SiteBadge } from './small';

export function Range({ low, high, what }: { low: string; high: string; what: string }) {
  return (
    <View {...mark('range')} style={{ gap: space.s1 }}>
      <Txt role="amount">{`${low} to ${high}`}</Txt>
      <Txt role="body" tone="ink-2">{what}</Txt>
    </View>
  );
}

// The range while the sales are read: the same 50 line and its label line, in gray, so nothing moves when it lands.
export function RangeSkeleton() {
  const c = useColors();
  return (
    <View {...mark('range', { skeleton: 'true' })} accessibilityLabel="Loading" style={{ gap: space.s1 }}>
      <View style={{ height: 60, justifyContent: 'center' }}><View style={{ width: '70%', height: 44, borderRadius: radius.pill, backgroundColor: c.gray }} /></View>
      <View style={{ height: 20, justifyContent: 'center' }}><View style={{ width: '60%', height: 14, borderRadius: radius.pill, backgroundColor: c.gray }} /></View>
    </View>
  );
}

export function KeepRow({ site, keep, line, note }: {
  site: Site;
  // What the person keeps after the fee, as a range: "$61 to $83". None when there are too few sales here.
  keep?: string;
  // How it goes there: "Sells in about 6 days", "Too few sales here", "Checking".
  line: string;
  // A second, quieter fact: "Not linked".
  note?: string;
}) {
  return (
    <View {...mark('keep-row', { site })} style={{ height: size.noticeH, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
      <SiteBadge site={site} />
      <View style={{ flex: 1, gap: space.s1 }}>
        <Txt role="body" tone={keep ? 'ink' : 'ink-2'} lines={1}>{line}</Txt>
        {note ? <Txt role="caption" lines={1}>{note}</Txt> : null}
      </View>
      {keep ? <Txt role="body">{keep}</Txt> : null}
    </View>
  );
}

export function SaleRow({ id, site, sold, line, counted, onToggle }: {
  id: string;
  site: Site;
  // What they sold for here: "$68 to $92". None when there are too few sales to go by.
  sold?: string;
  // How it went: "Sold in about 6 days", "Too few sales here".
  line: string;
  counted: boolean;
  onToggle?: () => void;
}) {
  const c = useColors();
  const row = (
    <View {...mark('sale-row', { site, counted: sold ? String(counted) : '' })} style={{ height: size.noticeH, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
      <SiteBadge site={site} />
      <View style={{ flex: 1, gap: space.s1 }}>
        <Txt role="body" tone={sold && counted ? 'ink' : 'ink-2'} lines={1}>{sold ? `Sold for ${sold}` : line}</Txt>
        {sold ? <Txt role="caption" lines={1}>{counted ? line : 'Left out'}</Txt> : null}
      </View>
      {sold ? (
        <View style={{ width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, backgroundColor: counted ? c.ink : c.surface,
          borderWidth: 2, borderColor: counted ? c.ink : c.ink2, alignItems: 'center', justifyContent: 'center', ...FLAT }}>
          {counted ? <Icon name="tick-02" size={12} tone="page" /> : null}
        </View>
      ) : null}
    </View>
  );
  if (!sold) return row;
  return <Press id={id} label={`Sales here, ${counted ? 'counted' : 'left out'}`} selected={counted} onPress={onToggle} round={false}>{row}</Press>;
}
