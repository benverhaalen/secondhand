// The camera (spec/pages.md §6.5; spec/features/capture.md; app/behavior/camera.json). The person presses the shutter for
// every still and the app judges each one where they can see it: a point cloud gathers where it finds things, what it read
// drops in from above and flies to its stage, the stage fills to a check, and each fact fills its chip. A fact not found is
// a Blank the person can fill. On the web a photo stands in for the feed.
//
// ?mode= sell | worth | find (New's three choices). ?world= a demo world. ?state= draws one moment still, for the gallery
// and the tests: loading (a still being judged), found, same, offline, done, denied, and, for the brass lamp from a
// relative's spare room, unsure (two lamps look alike) and valuable (a maker's mark).
//
// What people get wrong or do not know (spec/edge-cases.md §3, §4, §6, agent proposal): a typed brand shows as the catalog
// spells it; when it isn't sure what the thing is, it shows what it might be, most likely first with the odds of each, and
// a tap fills in what that thing is known to be (Ben, 08:09); "I don't know" is an answer; a maker's mark stops the quick
// path and suggests an appraisal; and Clean up and Enhance with AI are two named choices, both off until picked. The AI
// redraw can't be picked until the LiDAR scan has measured the thing, since a redraw is only trusted once it is held to
// its real size (Ben, 08:09: "it can only ai beautify if you have dimensions or else you cannot trust it"; 09:09: "only
// allow this from lidar flow too"; jobs/studio/check.py). A size the person typed doesn't count. ?lidar=0 draws a phone
// without LiDAR: the Measure stage finds no sizes, and AI stays off.
//
// What the camera or a model filled sits on the lilac tint; what the person typed is plain (Ben, 08:12).
// one at a time: cam-close (alternatives of one state each; .agents/checks/screens.mjs S2)
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useScreen } from '@/demo/screen';
import { CHOICES, ENDS, STAGES, factsFor, matching, rememberMode, sameAs, stepsFor, type FactKey, type Mode, type Stage } from '@/demo/capture';
import { LAMP, correct, type LampFacts } from '@/demo/capture-edges';
import { feed } from '@/demo/capture-photos';
import { photo } from '@/demo/photos';
import {
  CamButton, CamNote, CamWord, CameraAct, CameraBar, CameraFoot, CameraOff, Chips, CircleStage, FactChip, FixChip, FoundPop, Instruction, Line,
  MODE_ICON, Modes, OVER, Photo, Pill, PointCloud, Row, Sheet, Shutter, ShutterRow, StageBubbles, Txt, Viewfinder, cue, haptic, log, useCameraLayout,
  List, usePlus, type Bubble, type CirclePhase, type PhotoSrc,
} from '@/ui';
import { CandidateRow } from '@/ui/parts/candidates';

type Phase = 'typical' | 'loading' | 'found' | 'done';
type Drawn = 'loading' | 'found' | 'same' | 'offline' | 'done' | 'denied' | 'unsure' | 'valuable';
const DRAWN: Drawn[] = ['loading', 'found', 'same', 'offline', 'done', 'denied', 'unsure', 'valuable'];
// The names the catalog spells: what a person types here is matched before it is shown (edge-cases §3).
const NAMED: FactKey[] = ['brand', 'model'];
// An ask over the camera about the lamp: which of two it is, then whether it may be worth more.
type Ask = 'unsure' | 'valuable';
const DONT_KNOW = 'I don’t know';
// None of these: the kind is left as a blank to type, and nothing is filled.
const NONE = 'None of these';
// The measurements that hold a redraw to its real size (jobs/studio/check.py: width over length set back to the scan's).
// Only the LiDAR scan finds them (engines/capture/fields.ts: the measured way needs has_lidar).
const SIZED: FactKey[] = ['chest', 'length', 'sleeve'];
const scannedBy = (lidar: boolean) => (f: { fact: FactKey }) => lidar || !SIZED.includes(f.fact);
const MODES = CHOICES.map(c => ({ mode: c.mode, icon: MODE_ICON[c.mode], label: c.mode === 'sell' ? 'Sell' : c.mode === 'worth' ? 'Worth' : 'Find' }));
const plural = (n: number, one: string, many: string) => `${new Intl.NumberFormat('en-US').format(n)} ${n === 1 ? one : many}`;

// Where a drawn moment starts: which stages are done, what is known, how many stills.
function start(drawn: Drawn | null, mode: Mode, lidar: boolean) {
  const steps = stepsFor(mode), all = (n: number) => steps.slice(0, n);
  const known = (n: number) => Object.fromEntries(all(n).flatMap(s => s.finds.filter(scannedBy(lidar)).map(f => [f.fact, f.value]))) as Partial<Record<FactKey, string>>;
  switch (drawn) {
    case 'loading': return { done: [], facts: {}, stills: 1, phase: 'loading' as Phase, cur: steps[0].stage };
    case 'found': return { done: [], facts: known(1), stills: 1, phase: 'found' as Phase, cur: steps[0].stage };
    case 'same': return { done: [steps[0].stage], facts: known(1), stills: 1, phase: 'typical' as Phase, cur: steps[1]?.stage ?? null };
    // The lamp: its first still is judged and the camera asks about it before going on.
    case 'unsure': case 'valuable': return { done: [], facts: {}, stills: 1, phase: 'typical' as Phase, cur: steps[0].stage };
    case 'offline': return { done: [], facts: {}, stills: 2, phase: 'typical' as Phase, cur: steps[2]?.stage ?? steps.at(-1)!.stage };
    case 'done': return { done: steps.map(s => s.stage), facts: known(steps.length), stills: steps.length, phase: 'done' as Phase, cur: null };
    default: return { done: [], facts: {}, stills: 0, phase: 'typical' as Phase, cur: steps[0].stage };
  }
}

export default function Camera() {
  const params = useLocalSearchParams<{ mode?: string; state?: string; lidar?: string }>();
  const lidar = params.lidar !== '0';
  const drawn = DRAWN.includes(params.state as Drawn) ? (params.state as Drawn) : null;
  // The person it is drawn for (useScreen is the one way a page reads ?world=); the camera's own moments are its ?state=.
  const { w } = useScreen();
  const first = (['sell', 'worth', 'find'] as Mode[]).includes(params.mode as Mode) ? (params.mode as Mode) : 'sell';
  const begin = useMemo(() => start(drawn, first, lidar), [drawn, first, lidar]);

  const [mode, setMode] = useState<Mode>(first);
  const [phase, setPhase] = useState<Phase>(begin.phase);
  const [cur, setCur] = useState<Stage | null>(begin.cur);
  const [done, setDone] = useState<Stage[]>(begin.done);
  const [skipped, setSkipped] = useState<Stage[]>([]);
  // Stages shot without signal: their stills wait on the phone and are judged when it returns (ways-out, bad signal).
  const [queued, setQueued] = useState<Stage[]>(drawn === 'offline' ? stepsFor(first).slice(0, 2).map(s => s.stage) : []);
  const [facts, setFacts] = useState<Partial<Record<FactKey, string>>>(begin.facts);
  const [stills, setStills] = useState(begin.stills);
  const [waiting, setWaiting] = useState(drawn === 'offline' ? begin.stills : 0);
  const [blink, setBlink] = useState(0);
  const [same, setSame] = useState(drawn === 'same');
  const [askedSame, setAskedSame] = useState(drawn === 'same');
  const [circle, setCircle] = useState<CirclePhase>('open');
  const online = drawn !== 'offline';
  const lamp = drawn === 'unsure' || drawn === 'valuable';
  const [asking, setAsking] = useState<Ask | null>(lamp ? (drawn as Ask) : null);
  // What the person said the lamp is: one of the candidates, or "I don't know", which is an answer too.
  const [kind, setKind] = useState<string | null>(null);
  // What the pick filled in for the lamp, and the facts the person typed themselves (shown plain, not as suggestions).
  const [lampFacts, setLampFacts] = useState<Partial<LampFacts>>({});
  const [mine, setMine] = useState<string[]>([]);
  const [appraise, setAppraise] = useState(false);
  // The two ways to make the photos better, both off until the person picks one (edge-cases §6).
  const [clean, setClean] = useState(false);
  const [ai, setAi] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const native = Platform.OS !== 'web';
  useEffect(() => { if (native && permission && !permission.granted && permission.canAskAgain) requestPermission(); }, [native, permission, requestPermission]);
  const denied = drawn === 'denied' || (native && !!permission && !permission.granted && !permission.canAskAgain);
  const lens = useRef<CameraView>(null);

  const steps = stepsFor(mode), step = steps.find(s => s.stage === cur) ?? null;
  const layout = useCameraLayout(), plus = usePlus();
  const state = denied ? 'denied' : same ? 'same' : asking ?? (!online ? 'offline' : phase);
  useEffect(() => { cue({ type: 'show', screen: 'camera', state, mode, stills }); }, [state, mode, stills]);

  // The next step whose stage is not settled, in the tree's order; none left means done.
  const advance = useCallback((settled: Stage[], m: Mode = mode) => {
    const next = stepsFor(m).find(s => !settled.includes(s.stage));
    if (next) { setCur(next.stage); setPhase('typical'); return; }
    setCur(null); setPhase('done'); haptic.success(); cue({ type: 'show', screen: 'camera', state: 'done', mode: m });
  }, [mode]);

  // A still: the feed blinks; with signal it is judged, without it waits and the steps go on.
  const judge = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (judge.current) clearTimeout(judge.current); }, []);
  const shoot = () => {
    if (!step || phase !== 'typical') return;
    setBlink(b => b + 1); setStills(n => n + 1);
    if (native) lens.current?.takePictureAsync({ skipProcessing: true }).catch(e => log.error('camera.still', e, { stage: step.stage }));
    if (!online) { const q = [...queued, step.stage]; setQueued(q); setWaiting(n => n + 1); advance([...done, ...skipped, ...q]); return; }
    setPhase('loading');
    if (drawn) return;
    judge.current = setTimeout(() => {
      setFacts(f => ({ ...f, ...Object.fromEntries(step.finds.filter(scannedBy(lidar)).map(x => [x.fact, x.value])) }));
      setPhase('found');
      cue({ type: 'found', stage: step.stage, text: popOf(step) });
    }, step.judgeMs);
  };
  // The pop reached its bubble: the stage is done.
  const landed = () => {
    if (!step) return;
    const settled = [...done, step.stage];
    setDone(settled); cue({ type: 'stage', stage: step.stage, done: true });
    const held = step.stage === 'Kind' && !askedSame ? sameAs(w) : null;
    if (held) { setAskedSame(true); setSame(true); }
    advance([...settled, ...skipped, ...queued]);
  };
  const skip = () => { if (!step || phase !== 'typical') return; const s = [...skipped, step.stage]; setSkipped(s); advance([...done, ...s, ...queued]); };
  const pick = (m: Mode) => {
    if (m === mode) return;
    rememberMode(m); setMode(m);
    cue({ type: 'show', screen: 'camera', mode: m, stills });
    if (phase === 'typical' || phase === 'done') advance([...done, ...skipped, ...queued], m);
  };
  const library = () => {
    ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true })
      .then(r => { if (!r.canceled && r.assets.length) router.replace('/sell' as Href); }).catch(e => log.error('camera.library', e));
  };
  // Which lamp it is, or "I don't know": then the maker's mark, which matters whatever it is.
  const answer = (k: string) => {
    const picked = LAMP.candidates.find(c => c.id === k);
    if (picked) setLampFacts(picked.fills);
    setKind(picked ? picked.name : k); setAsking('valuable'); cue({ type: 'show', screen: 'camera', kind: picked?.name ?? k });
  };
  const valued = (first: boolean) => { setAppraise(first); setAsking(null); cue({ type: 'show', screen: 'camera', appraise: first }); };
  const typed = (key: FactKey, v: string) => { setMine(m => [...m, key]); setFacts(x => ({ ...x, [key]: NAMED.includes(key) ? correct(v) : v.trim() })); };
  const typedLamp = (key: keyof LampFacts, v: string) => { setMine(m => [...m, key]); setLampFacts(x => ({ ...x, [key]: v.trim() })); };
  // Without LiDAR the Measure still finds no size, so its pop doesn't claim one: the sizes are left to type.
  const popOf = (st: NonNullable<typeof step>) => (!lidar && st.finds.every(f => SIZED.includes(f.fact)) ? 'Type the sizes' : st.pop);
  const sized = lidar && SIZED.some(k => facts[k] && !mine.includes(k));
  const leave = useCallback((p: CirclePhase) => { if (p === 'closed') { if (router.canGoBack()) router.back(); else router.replace('/' as Href); } }, []);
  const close = () => setCircle('closing');

  const bubbles = STAGES[mode].map(name => ({
    name,
    state: (done.includes(name) ? 'done' : skipped.includes(name) || queued.includes(name) ? 'skipped' : name === cur && phase !== 'done' ? 'now' : 'later') as Bubble,
  }));
  const held = sameAs(w);
  const ask = phase === 'done' ? matching() : step?.ask ?? '';
  const target = layout.bubble(Math.max(0, STAGES[mode].indexOf(step?.stage ?? 'Kind')), STAGES[mode].length);
  const shownFeed = lamp ? photo(LAMP.key) : feed(step?.feed ?? (phase === 'done' ? 'back' : 'front'));
  const lampPhoto = photo(LAMP.key) as PhotoSrc;

  if (denied) {
    return (
      <CircleStage origin={plus} phase={circle} onSettled={leave}>
        <Stack.Screen options={OVER} />
        <Viewfinder state="denied" top={<CameraBar left={<CamButton id="cam-close" icon="cancel-01" label="Close" onPress={close} />} />}>
          <CameraOff title="Camera is off" line="Allow it in Settings, or choose photos you already have." acts={[
            { id: 'denied-settings', label: 'Open Settings', onPress: () => { Linking.openSettings().catch(e => log.error('camera.settings', e)); } },
            { id: 'denied-library', label: 'Choose photos', onPress: library },
          ]} />
        </Viewfinder>
      </CircleStage>
    );
  }

  return (
    <CircleStage origin={plus} phase={circle} onSettled={leave}>
      <Stack.Screen options={OVER} />
      <Viewfinder
        state={state} mode={mode} feed={native ? null : shownFeed} live={native && !!permission?.granted} camera={lens} blink={blink}
        cloud={step && !lamp ? <PointCloud key={`${mode}-${step.stage}`} outline={step.outline} features={step.features} spread={step.judgeMs} phase={phase === 'loading' ? 'gather' : phase === 'typical' ? 'outline' : 'gone'} /> : null}
        top={(
          <>
            <CameraBar left={<CamButton id="cam-close" icon="cancel-01" label="Close" onPress={close} />}>
              <StageBubbles stages={bubbles} />
            </CameraBar>
            <Instruction text={ask} />
          </>
        )}
        framed
        facts={(
          <Chips>
            {!online && waiting ? <CamNote icon="clock-01" text={`${plural(waiting, 'photo', 'photos')} waiting for signal`} /> : null}
            {kind === DONT_KNOW ? <CamNote icon="information-circle" text="Listed from what can be seen" /> : null}
            {appraise ? <CamNote icon="information-circle" text="Appraise first: no quick sale" /> : null}
            {/* Found first, so what is left to fill is where the line runs on. */}
            {lamp ? (kind && kind !== DONT_KNOW ? LAMP.facts.map(f => (
              <FactChip key={f.key} id={`fact-${f.key}`} name={f.name} value={lampFacts[f.key]} by={mine.includes(f.key) ? 'person' : 'agent'} onChange={v => typedLamp(f.key, v)} />
            )) : null) : [...factsFor(mode)].sort((a, b) => Number(!facts[a.key]) - Number(!facts[b.key])).map(f => (
              <FactChip key={f.key} id={`fact-${f.key}`} name={f.name} value={facts[f.key]} by={mine.includes(f.key) ? 'person' : 'agent'} onChange={v => typed(f.key, v)} />
            ))}
            {phase === 'done' && !sized ? <CamNote icon="information-circle" text={lidar ? 'Scan it to use AI' : 'AI needs a phone with LiDAR'} /> : null}
          </Chips>
        )}
        bottom={(
          <CameraFoot>
            {phase === 'done' ? (
              <>
                <Chips>
                  <FixChip id="cam-clean" label="Clean up" on={clean} onPress={() => setClean(x => !x)} />
                  <FixChip id="cam-ai" label="Enhance with AI" on={ai && sized} disabled={!sized} onPress={() => setAi(x => !x)} />
                </Chips>
                <CameraAct id="cam-done" label={ENDS[mode].label} onPress={() => router.replace(ENDS[mode].to as Href)} />
              </>
            ) : (
              <>
                <Modes modes={MODES} current={mode} onPick={pick} />
                <ShutterRow
                  left={<CamButton id="cam-library" icon="image-01" label="Choose photos" onPress={library} />}
                  center={<Shutter id="cam-shutter" waiting={phase !== 'typical' || same || !!asking} onPress={shoot} />}
                  right={<CamWord id="cam-skip" label="Skip" onPress={skip} />}
                />
              </>
            )}
          </CameraFoot>
        )}>
        {phase === 'found' && step ? <FoundPop key={step.stage} text={popOf(step)} to={target} stay={!!drawn} onLanded={landed} /> : null}
      </Viewfinder>
      <Sheet open={same && !!held} title="Same thing?" onClose={() => setSame(false)}>
        {held ? (
          <Row lead={<Photo src={photo(held.photos[0]?.key ?? 'carhartt-jacket') as PhotoSrc} label={held.title} />}>
            <Txt role="headline" lines={2}>{held.title}</Txt>
            <Txt role="caption">Already yours</Txt>
          </Row>
        ) : null}
        <Line>
          <Pill id="same-yes" label="Same one" onPress={() => router.replace(`/item/${held?.id ?? ''}` as Href)} />
          <Pill id="same-no" kind="second" label="Another one" onPress={() => setSame(false)} />
        </Line>
      </Sheet>
      {/* Lamps look alike: what it might be, most likely first with the odds of each; a tap fills in what that one is. None
          of these and "I don't know" sit under them as answers of the same weight (edge-cases §4). */}
      <Sheet open={asking === 'unsure'} title="Which one is it?" onClose={() => answer(DONT_KNOW)}>
        <Row lead={<Photo src={lampPhoto} label="Your photo" />}>
          <Txt role="caption">{`${LAMP.candidates.length} kinds look like this`}</Txt>
        </Row>
        <List>
          {LAMP.candidates.map((c, i) => <CandidateRow key={c.id} id={`unsure-${i + 1}`} c={c} calibrated={LAMP.calibrated} onPick={() => answer(c.id)} />)}
        </List>
        <Line>
          <Pill id="unsure-other" kind="second" label={NONE} onPress={() => answer(NONE)} />
          <Pill id="unsure-none" kind="second" label={DONT_KNOW} onPress={() => answer(DONT_KNOW)} />
        </Line>
      </Sheet>
      {/* A maker's mark: the quick path stops, and an appraisal comes before a price (edge-cases §4). */}
      <Sheet open={asking === 'valuable'} title="It may be worth more" onClose={() => valued(false)}>
        <Txt role="body">{`${LAMP.mark}. Get it appraised before you price it. Until then it is never sold fast or marked down.`}</Txt>
        <Line>
          <Pill id="valuable-appraise" label="Appraise first" onPress={() => valued(true)} />
          <Pill id="valuable-price" kind="second" label="Price it anyway" onPress={() => valued(false)} />
        </Line>
      </Sheet>
    </CircleStage>
  );
}
