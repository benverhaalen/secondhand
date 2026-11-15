import { Stack as RouterStack, router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ShotGuide, shotTitle } from '@/ui/parts/shot-guide';
import { PickType } from './pick';
import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/api/client';
import type { Question } from '@/engines/capture/plan';
import {
  Blank, CamButton, CamNote, CameraAct, CameraBar, CameraFoot, CameraOff, Chips, ChoiceChips,
  FactChip, FootButton, Instruction, OVER, Screen, Nav, Section, Sheet, Shutter, ShutterRow, Stack, Txt, Viewfinder, log,
} from '@/ui';
import { answerCapture, captureMessage, openCapture, readCapture, requestStudio, setType, skipQuestion, uploadStills, type Capture, type Still } from './client';
import { CaptureResults, type CaptureJob } from './results';

const words = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' ');
const valueText = (value: unknown) => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
const COACH_MS = 4000;
const purposeOf =(mode: string): Capture['purpose'] => mode === 'worth' ? 'appraise' : mode === 'find' ? 'find' : 'sell';

function Answer({ question, busy, onAnswer }: { question: Question; busy: boolean; onAnswer: (value: unknown) => void }) {
  const [value, setValue] = useState('');
  const [parts, setParts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>(() => question.options.flatMap((option, index) => option.proposed ? [String(index)] : []));
  const options = question.options.map((option, index) => ({ id: String(index), label: option.label ?? words(valueText(option.value)) }));
  return <Stack>
    {options.length ? <ChoiceChips id={`capture-${question.id}`} label={question.words} value={question.kind === 'pick_many' ? selected : selected[0] ?? ''} options={options}
      onChange={id => { if (busy) return; if (question.kind === 'pick_many') setSelected(values => values.includes(id) ? values.filter(v => v !== id) : [...values, id]); else { setSelected([id]); onAnswer(question.options[Number(id)].value); } }} /> : null}
    {selected.flatMap(id => question.options[Number(id)].rests_on ?? []).map((reason, index) => <Txt key={index} role="caption" tone="ink-2">{reason}</Txt>)}
    {question.kind === 'pick_many' ? <><Txt role="caption">{selected.map(id => options[Number(id)].label).join(', ') || 'Choose any that apply'}</Txt><FootButton id="capture-list-answer" label="Use these" state={selected.length && !busy ? 'idle' : 'disabled'} onPress={() => onAnswer(selected.map(id => question.options[Number(id)].value))} /></> : null}
    {question.parts?.length ? <>
      {question.parts.map(part => <Blank key={part} id={`capture-part-${part}`} name={`${words(part)}${question.unit ? ` (${question.unit})` : ''}`} numeric value={parts[part] ?? ''} onChange={next => setParts(old => ({ ...old, [part]: next }))} />)}
      <FootButton id="capture-dimensions" label="Use measurements" state={!busy && question.parts.every(part => Number(parts[part]) > 0) ? 'idle' : 'disabled'} onPress={() => onAnswer(Object.fromEntries(question.parts!.map(part => [part, Number(parts[part])])))}/>
    </> : !options.length || question.other ? <>
      <Blank id="capture-answer" live name={question.unit ? `${question.words} (${question.unit})` : question.words} value={value} onChange={setValue} numeric={question.kind === 'number_with_unit'} />
      <FootButton id="capture-answer-save" label="Use this" state={value.trim() && !busy ? 'idle' : 'disabled'} onPress={() => onAnswer(question.kind === 'number_with_unit' ? Number(value) : value.trim())} />
    </> : null}
  </Stack>;
}

export function LiveCapture({ mode }: { mode: string }) {
  const purpose = purposeOf(mode);
  const camera = useRef<CameraView>(null);
  const opening = useRef<Promise<Capture> | null>(null);
  const [permission, askPermission] = useCameraPermissions();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Still[]>([]);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [blink, setBlink] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [finished, setFinished] = useState(false);
  const [jobs, setJobs] = useState<CaptureJob[]>([]);
  const [studio, setStudio] = useState(false);
  // What the item is, asked first on its own page (Nate, words.md 2026-11-15); "Something else" leaves it to the photo.
  const [picked, setPicked] = useState(false);
  const [family, setFamily] = useState<string | null>(null);
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as Href);

  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(null);
    try { await operation(); } catch (failure) { log.error('capture.live', failure); setError(captureMessage(failure)); } finally { setBusy(''); }
  };
  const start = () => {
    opening.current ??= openCapture(purpose).catch(failure => { opening.current = null; throw failure; });
    return opening.current;
  };
  useEffect(() => {
    let current = true;
    start().then(next => { if (current) setCapture(next); }).catch(failure => { log.error('capture.open', failure); if (current) setError(captureMessage(failure)); });
    return () => { current = false; };
  }, []);

  const shotQuestion = capture?.plan.questions.find(next => next.kind === 'shot');
  const nextStep = capture?.plan.process.find(step => step.state === 'pending' || step.state === 'retake');
  const step = shotQuestion?.shot?.step ?? nextStep?.key ?? 'front';
  const role = nextStep?.role ?? step;
  const ask = shotQuestion?.words ?? (nextStep ? `Photograph the ${words(nextStep.step)}` : capture ? 'Review what we found' : 'Show the whole front');
  const questions = capture?.plan.questions.filter(next => next.kind !== 'shot') ?? [];
  const needsPhoto = !!nextStep || !!shotQuestion || !capture;
  // The coach for this shot shows for a few seconds, then leaves the frame to the person with the shot's name on top.
  const guideStep = (shotQuestion?.shot?.step ?? nextStep?.step ?? 'front').split('.')[0];
  const [coached, setCoached] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setCoached(guideStep), COACH_MS); return () => clearTimeout(t); }, [guideStep]);
  const coaching = !!permission?.granted && needsPhoto && !busy && !error && coached !== guideStep;

  const send = async (photos: Still[]) => {
    const current = capture ?? await start();
    const next = await uploadStills(current, photos);
    setCapture(next); setPending([]);
    return next;
  };
  const shoot = () => run('Checking photo', async () => {
    if (!camera.current) throw new Error('Allow the camera or choose a photo.');
    const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.4, exif: false });
    if (!photo?.base64) throw new Error('The photo was not captured. Try again.');
    setBlink(value => value + 1); setLastPhoto(photo.uri); setCoverPhoto(cover => cover ?? photo.uri);
    const photos: Still[] = [{ uri: photo.uri, base64: photo.base64, type: 'image/jpeg', step, role }];
    setPending(photos); await send(photos);
  });
  const library = () => run('Uploading photos', async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.4, allowsMultipleSelection: true });
    if (picked.canceled) return;
    const steps = capture?.plan.process.filter(next => next.state !== 'kept') ?? [];
    const photos = picked.assets.map((asset, index): Still => {
      if (!asset.base64) throw new Error('This photo could not be read. Choose another photo.');
      const target = steps[index];
      return { uri: asset.uri, base64: asset.base64, type: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg', step: target?.key ?? `${step}.${index + 1}`, role: target?.role ?? role };
    });
    setLastPhoto(photos[0]?.uri ?? null); setCoverPhoto(cover => cover ?? photos[0]?.uri ?? null); setPending(photos); await send(photos);
  });
  const refresh = () => run('Checking', async () => setCapture(capture ? await readCapture(capture.id) : await start()));
  const answer = (value: unknown) => {
    if (!capture || !question) return;
    void run('Saving answer', async () => { setCapture(await answerCapture(capture, question, value)); setQuestion(null); });
  };
  const finish = () => run(studio ? 'Preparing photos' : 'Saving item', async () => {
    // Photos still waiting go up first, so finish never does nothing; finish then reads the capture they produced.
    const current = pending.length ? await send(pending) : capture;
    if (!current || current.plan.status !== 'done') return;
    const result = await api.call<{ jobs?: CaptureJob[] }>(`POST /v1/captures/${encodeURIComponent(current.id)}/finish`, { body: { version: current.version } });
    setJobs(result.jobs ?? []);
    setFinished(true);
  });

  const pick = (type: string) => run('Saving', async () => {
    const current = capture ?? await start();
    setCapture(type === 'other' ? current : await setType(current, type));
    setFamily(type); setPicked(true);
  });
  if (!picked) return <PickType mode={mode} busy={!!busy} error={error} onPick={pick} onClose={close} />;

  if (finished && capture) return <Screen name="capture-result" state="typical" nav={<Nav back={close} />}>
    <Section title={purpose === 'find' ? 'Photo matches' : purpose === 'appraise' ? 'Your appraisal' : studio ? 'Your photos' : 'Your item'}>
      <CaptureResults capture={capture} initial={jobs} photo={coverPhoto} />
      <FootButton id="capture-messages" label={purpose === 'sell' ? 'Review item' : purpose === 'find' ? 'Back to Buy' : purpose === 'appraise' ? 'Done' : 'Open messages'} onPress={() => purpose === 'appraise' ? close() : router.replace((purpose === 'sell' ? `/item/${capture.item_id}/edit` : purpose === 'find' ? '/buy' : '/messages') as Href)} />
    </Section>
  </Screen>;

  return <>
    <RouterStack.Screen options={OVER} />
    <Viewfinder state={busy ? 'loading' : error ? 'failed' : 'typical'} mode={mode} live={!!permission?.granted} camera={camera} blink={blink} feed={!permission?.granted && lastPhoto ? { uri: lastPhoto } : null} framed
      top={<><CameraBar left={<CamButton id="cam-close" icon="cancel-01" label="Close" onPress={close} />}><CamNote icon="camera-01" text={purpose === 'appraise' ? 'Appraise an item' : purpose === 'find' ? 'Find an item' : 'Sell an item'} /></CameraBar><Instruction text={busy || (coaching ? '' : needsPhoto ? shotTitle(guideStep, shotQuestion?.words) : ask)} /></>}
      facts={<Chips>{capture?.plan.fields.filter(field => field.value !== null).map(field => <FactChip key={field.field} id={`fact-${field.field}`} name={words(field.field)} value={valueText(field.value)} by={field.source === 'you_said' ? 'person' : 'agent'} onChange={questions.find(q => q.field === field.field) ? () => setQuestion(questions.find(q => q.field === field.field)!) : undefined} />)}</Chips>}
      bottom={<CameraFoot>
        {busy ? <CamNote icon="clock-01" text={busy} /> : null}
        {questions.length ? <CameraAct id="capture-questions" label={questions[0].words} onPress={() => !busy && setQuestion(questions[0])} /> : null}
        {needsPhoto ? <ShutterRow left={<CamButton id="cam-library" icon="image-01" label="Choose photos" onPress={library} />} center={<Shutter id="cam-shutter" waiting={!!busy || !!pending.length} onPress={shoot} />} right={<CamButton id="capture-refresh" icon="refresh" label="Refresh guidance" onPress={refresh} />} /> : null}
        {!needsPhoto && capture?.plan.status !== 'done' ? <CameraAct id="capture-refresh" label="Check for results" onPress={refresh} /> : null}
        {capture?.plan.status === 'done' ? <>
          {purpose === 'sell' && !studio ? <CameraAct id="capture-beautify" label="Beautify photos" onPress={() => run('Checking photo requirements', async () => { setCapture(await requestStudio(capture)); setStudio(true); })} /> : null}
          <CameraAct id="cam-done" label={studio ? 'Prepare photos' : purpose === 'find' ? 'Find matches' : purpose === 'appraise' ? 'Appraise item' : 'Create draft'} onPress={finish} />
        </> : null}
      </CameraFoot>}>
      {coaching ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}><ShotGuide step={guideStep} family={family} words={shotQuestion?.words} /></View> : null}
      {needsPhoto && !permission?.granted && !error ? <CameraOff title="Use your camera" line="Take each photo when you are ready." acts={[{ id: 'camera-permission', label: 'Allow camera', onPress: () => permission?.canAskAgain === false ? void Linking.openSettings().catch(failure => setError(captureMessage(failure))) : void askPermission() }, { id: 'camera-library', label: 'Choose photos', onPress: library }]} /> : null}
      {error ? <CameraOff title="Could not continue" line={error} acts={[{ id: 'capture-retry', label: 'Try again', onPress: () => pending.length ? void run('Uploading photos', async () => { await send(pending); }) : refresh() }, { id: 'capture-error-close', label: 'Close', onPress: close }]} /> : null}
    </Viewfinder>
    <Sheet open={!!question} title={question?.words} onClose={() => setQuestion(null)}>
      {question ? <Answer key={question.id} question={question} busy={!!busy} onAnswer={answer} /> : null}
      {error ? <Txt role="body">{error}</Txt> : null}
      {question && capture && !question.required_by.length ? <FootButton id="capture-question-skip" kind="second" label="Skip" state={busy ? 'disabled' : 'idle'} onPress={() => run('Saving', async () => { setCapture(await skipQuestion(capture, question.field)); setQuestion(null); })} /> : null}
    </Sheet>
  </>;
}
