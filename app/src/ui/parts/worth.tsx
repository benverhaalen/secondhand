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
import { View } from 'react-native';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { mark, type Site } from './mark';
import { SiteBadge } from './small';

export function Range({ low, high, what }: { low: string; high: string; what: string }) {
  return (
    <View {...mark('range')} style={{ gap: space.s1 }}>
      <Txt role="amount">{`${low} to ${high}`}</Txt>
      <Txt role="body" tone="ink-2">{what}</Txt>
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
