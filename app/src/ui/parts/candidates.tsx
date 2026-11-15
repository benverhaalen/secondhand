// What it might be, most likely first, with the odds of each (Ben, 08:09: "a few options and its ranked by most likely
// and you choose the one that matches and it auto fills in"). The odds are the identify job's (jobs/identity/ladder.py,
// odds). A row is the content width by 64: the name in body ink, a 4 bar under it as long as the odds, in ink (colour is
// a ground, never a line: Art. 9.1), and what it was matched on as a caption. The odds are written as a percent on the
// right only once the kind is calibrated (fit_odds on at least MIN_LABELS confirmed captures), because only then is a
// shown 49% right about half the time; before that the bar ranks them without claiming a number. Rows go in a List.
import { View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { space } from '../tokens.generated';
import { mark } from './mark';

const H = 64;
const BAR = space.s1;

export type Candidate = { id: string; name: string; seen: string; odds: number };

// "49%"; under one percent reads "<1%", never "0%", since the job did find it.
export const pct = (p: number) => (p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

export function CandidateRow({ id, c: cand, calibrated, onPick }: { id: string; c: Candidate; calibrated: boolean; onPick: () => void }) {
  const c = useColors();
  return (
    <Press id={id} label={calibrated ? `${cand.name}, ${pct(cand.odds)}` : cand.name} onPress={onPick} round={false}>
      <View {...mark('candidate', { odds: cand.odds.toFixed(3) })} style={{ height: H, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View style={{ flex: 1, gap: space.s1 }}>
          <Txt role="body" lines={1}>{cand.name}</Txt>
          <View style={{ height: BAR, borderRadius: BAR, backgroundColor: c.gray, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, Math.round(cand.odds * 100))}%`, height: BAR, backgroundColor: c.ink }} />
          </View>
          <Txt role="caption" lines={1}>{cand.seen}</Txt>
        </View>
        {calibrated ? <Txt role="body" tabular>{pct(cand.odds)}</Txt> : null}
      </View>
    </Press>
  );
}
