import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { motion, MOTION } from './motion.mjs';

// Each of Emil's checks is shown failing on the mistake it exists to catch, and passing the code that does it right.
// The brand values a test repo starts with: the real durations and sizes, and a curve from Emil's table.
const BASE = {
  'app/src/ui/tokens.generated.ts': 'export const space = {\n  s1: 4,\n  s3: 12,\n} as const;\n\nexport const size = {\n  controlMin: 44,\n} as const;\n\nexport const type = {\n  t15: {"fontSize":15,"lineHeight":20},\n  t18: {"fontSize":18,"lineHeight":24},\n} as const;\n\nexport const motion = {\n  feedback: 150,\n  select: 200,\n  panel: 300,\n} as const;\n',
  'app/src/ui/motion.ts': "export const MOTIONS = {\n  sheet: { why: 'origin', ms: motion.panel },\n  drift: { why: 'recognition', ms: 'spring' },\n};\n",
  'brand/tokens.css': ':root { --ease-out: cubic-bezier(0.23, 1, 0.32, 1); }\n',
};
function findings(files) {
  const all = { ...BASE, ...files }, root = mkdtempSync(join(tmpdir(), 'motion-'));
  for (const [p, s] of Object.entries(all)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  try { return motion(root, { files: Object.keys(all) }); } finally { rmSync(root, { recursive: true }); }
}
// The errors one rule raises, one per line.
const errs = (id, files) => findings(files).filter(o => o.level === 'error' && o.msg.includes(`(${id},`)).map(o => `${o.where} ${o.msg}`).join('\n');
const UI = 'app/src/ui/part.tsx', SCREEN = 'app/src/app/sell.tsx';

test('motion E1: an animated height, width transition or blur fails; transform and opacity pass, and so does a childless absolute element that says so', () => {
  assert.match(errs('E1', { [UI]: 'const s = useAnimatedStyle(() => ({ height: h.get(), opacity: o.get() }));' }), /animates height/);
  assert.match(errs('E1', { [UI]: "const s = { transitionProperty: ['width', 'opacity'], transitionDuration: motion.select };" }), /names width/);
  assert.match(errs('E1', { [UI]: 'const p = useAnimatedProps(() => ({ intensity: blur.get() }));' }), /animates intensity/);
  assert.match(errs('E1', { [UI]: 'const s = useAnimatedStyle(() => ({\n  marginTop: y.get(),\n}));' }), /part\.tsx:2 .*marginTop/);
  assert.equal(errs('E1', { [UI]: 'const s = useAnimatedStyle(() => ({ opacity: open ? height : 0, transform: [{ translateY: y.get() }] }));' }), '');
  assert.equal(errs('E1', { [UI]: '// absolute, no children: the tab pill keeps its corners\nconst pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: w.get() }));' }), '');
});

test('motion E2: a token off the table, a timed motion over 300 ms, or a raw .duration() in a screen fails; named motions pass', () => {
  assert.match(errs('E2', { 'app/src/ui/tokens.generated.ts': BASE['app/src/ui/tokens.generated.ts'].replace('panel: 300', 'panel: 400') }), /motion\.panel is 400 ms/);
  assert.match(errs('E2', { 'app/src/ui/tokens.generated.ts': BASE['app/src/ui/tokens.generated.ts'].replace('feedback: 150', 'feedback: 200') }), /between 100 and 160/);
  assert.match(errs('E2', { [UI]: 'y.set(withTiming(0, { duration: 450, easing: EASE_OUT }));' }), /450 ms motion/);
  assert.match(errs('E2', { [UI]: "const box = { transitionProperty: 'transform', transitionDuration: '0.4s' };" }), /400 ms motion/);
  assert.match(errs('E2', { [SCREEN]: '<Animated.View entering={FadeIn.duration(250)} />' }), /raw duration in a screen/);
  assert.match(errs('E2', { [SCREEN]: "const box = { transitionProperty: 'transform', transitionDuration: '120ms' };" }), /raw duration in a screen/);
  assert.equal(errs('E2', { [SCREEN]: 'y.set(withTiming(0, { duration: motion.panel }));\n<Animated.View entering={FadeIn.duration(MOTIONS.sheet.ms)} />',
    [UI]: "const box = { transitionProperty: 'transform', transitionDuration: '120ms' };" }), '');
});

test('motion E3: an exit as long as its entrance fails, defaults included; a shorter exit passes, read through constants', () => {
  assert.match(errs('E3', { [UI]: '<Animated.View entering={FadeIn.duration(motion.select)} exiting={FadeOut.duration(motion.select)} />' }), /leaves in 200 ms and arrives in 200 ms/);
  assert.match(errs('E3', { [UI]: '<Animated.View entering={FadeInDown} exiting={FadeOutDown} />' }), /leaves in 300 ms/);
  assert.equal(errs('E3', { [UI]: 'const TOAST_ENTER = FadeInDown.duration(300).easing(EASE_OUT);\nconst TOAST_EXIT = FadeOutDown.duration(250).easing(EASE_OUT);\n<Animated.View entering={TOAST_ENTER} exiting={TOAST_EXIT} />' }), '');
  assert.equal(errs('E3', { [UI]: '<Animated.View entering={FadeIn.duration(motion.select)} exiting={FadeOut.duration(motion.feedback)} />\n<Animated.View entering={enter} exiting={exit} />' }), '');
});

test('motion E4: Easing.in or an ease-in timing function fails; ease-out and ease pass', () => {
  assert.match(errs('E4', { [UI]: 'y.set(withTiming(1, { duration: motion.select, easing: Easing.in(Easing.quad) }));' }), /ease-in/);
  assert.match(errs('E4', { [UI]: "const box = { transitionTimingFunction: 'ease-in' };" }), /ease-in/);
  assert.equal(errs('E4', { [UI]: "const a = Easing.bezier(0.23, 1, 0.32, 1);\nconst box = { transitionTimingFunction: 'ease' };\nconst c = { transitionTimingFunction: 'ease-in-out' };" }), '');
});

test('motion E5: a hand-made curve or a weak built-in fails; Emil\'s three, linear and the brand\'s own curve pass, and a weak brand curve is a question', () => {
  assert.match(errs('E5', { [UI]: 'const e = Easing.bezier(0.25, 0.1, 0.25, 1);' }), /neither Emil's table/);
  assert.match(errs('E5', { [UI]: 'const e = Easing.out(Easing.cubic);' }), /Easing\.out is a built-in curve/);
  assert.match(errs('E5', { [UI]: "const box = { transitionTimingFunction: 'ease-out' };" }), /'ease-out' is a built-in curve/);
  assert.equal(errs('E5', { [UI]: "const a = Easing.bezier(0.77, 0, 0.175, 1);\nconst b = Easing.linear;\nconst c = { transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' };" }), '');
  const soft = { 'brand/tokens.css': ':root { --ease-out: cubic-bezier(0, 0, .2, 1); }\n', [UI]: 'const e = Easing.bezier(0, 0, 0.2, 1);' };
  assert.equal(errs('E5', soft), '');
  assert.match(findings(soft).filter(o => o.level === 'warn').map(o => o.msg).join('\n'), /--ease-out is cubic-bezier\(0, 0, 0\.2, 1\), weaker/);
});

test('motion E6: a spring set by physics, off the table, or with no config fails; Apple\'s form at the table\'s values passes', () => {
  assert.match(errs('E6', { [UI]: 'y.set(withSpring(0, { stiffness: 100, damping: 10 }));' }), /mass, stiffness or damping/);
  assert.match(errs('E6', { [UI]: 'y.set(withSpring(0, { duration: 500, dampingRatio: 0.5 }));' }), /500 ms at dampingRatio 0\.5/);
  assert.match(errs('E6', { [UI]: 'scale.set(withSpring(1));' }), /no config/);
  assert.match(errs('E6', { [UI]: 'const enter = FadeIn.springify().damping(10);' }), /\.damping\(\)/);
  assert.equal(errs('E6', { [UI]: 'y.set(withSpring(0, { duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true }));\nconst SETTLE = { duration: 400, dampingRatio: 1 };\nx.set(withSpring(1, SETTLE));' }), '');
});

test('motion E7: a spring or a curve while the finger is down fails; 1:1 tracking passes, and so does Emil\'s timed exit once a swipe commits', () => {
  assert.match(errs('E7', { [UI]: 'const pan = Gesture.Pan().onUpdate((e) => { y.set(withSpring(e.translationY, SETTLE)); });' }), /withSpring in onUpdate/);
  assert.match(errs('E7', { [UI]: 'const pan = Gesture.Pan()\n  .activeOffsetY([-10, 10])\n  .onChange((e) => { y.set(withTiming(y.get() + e.changeY)); });' }), /withTiming in onChange/);
  assert.match(errs('E7', { [UI]: 'const pan = usePanGesture({ onUpdate: (e) => { x.set(withTiming(e.translationX)); }, onDeactivate: (e) => {} });' }), /withTiming in onUpdate/);
  assert.equal(errs('E7', { [UI]: 'const pan = Gesture.Pan().onUpdate((e) => { x.set(Math.min(0, start.get() + e.translationX)); }).onEnd((e) => {\n  if (gone) x.set(withTiming(-WIDTH, { duration: motion.select, easing: EASE_OUT }));\n  else x.set(withSpring(0, { duration: 300, dampingRatio: 1, velocity: e.velocityX }));\n});' }), '');
});

test('motion E8: React state, a call back to React or a haptic in a per-frame handler fails; shared values and a commit in onEnd pass', () => {
  assert.match(errs('E8', { [UI]: 'const pan = Gesture.Pan().onUpdate((e) => { setY(e.translationY); });' }), /setY\(\) in onUpdate/);
  assert.match(errs('E8', { [UI]: 'const pan = Gesture.Pan().onChange((e) => { scheduleOnRN(report, e.x); });' }), /scheduleOnRN in onChange/);
  assert.match(errs('E8', { [UI]: 'const h = useAnimatedScrollHandler((e) => { if (e.contentOffset.y > 60) Haptics.selectionAsync(); });' }), /haptic in useAnimatedScrollHandler/);
  assert.match(errs('E8', { [UI]: '<ScrollView onScroll={(e) => setTop(e.nativeEvent.contentOffset.y)} />' }), /setTop\(\) in onScroll/);
  assert.equal(errs('E8', { [UI]: 'const h = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });\nconst pan = Gesture.Pan().onUpdate((e) => { y.set(e.translationY); }).onEnd(() => { scheduleOnRN(Haptics.impactAsync, light); });\n<Animated.ScrollView onScroll={h} />' }), '');
});

test('motion E9: core Animated, PanResponder, runOnJS, .value or a keyboard listener driving motion fails; Reanimated 4 passes', () => {
  assert.match(errs('E9', { [UI]: "import { Animated, View } from 'react-native';" }), /Animated from react-native/);
  assert.match(errs('E9', { [UI]: "import { PanResponder } from 'react-native';" }), /PanResponder from react-native/);
  assert.match(errs('E9', { [UI]: 'runOnJS(done)();' }), /runOnJS is deprecated/);
  assert.match(errs('E9', { [UI]: 'const y = useSharedValue(0);\ny.value = 10;' }), /y\.value/);
  assert.match(errs('E9', { [UI]: "Keyboard.addListener('keyboardWillShow', e => y.set(withTiming(-e.endCoordinates.height)));" }), /react-native-keyboard-controller/);
  assert.equal(errs('E9', { [UI]: "import Animated, { useSharedValue } from 'react-native-reanimated';\nimport { View } from 'react-native';\nconst y = useSharedValue(0);\ny.set(10);\nKeyboard.addListener('keyboardDidHide', close);" }), '');
});

test('motion E10: a press that scales to anything but 0.97, a ripple, a Touchable, or a Pressable with no press-in fails; Emil\'s press passes', () => {
  assert.match(errs('E10', { [UI]: 'const styles = StyleSheet.create({ box: {}, pressed: { transform: [{ scale: 0.95 }] } });' }), /scales to 0\.95/);
  assert.match(errs('E10', { [UI]: '<Pressable style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }] })} />' }), /scales to 0\.9/);
  assert.match(errs('E10', { [UI]: '<Pressable onPressIn={() => scale.set(withTiming(0.95, { duration: motion.feedback }))} />' }), /scales to 0\.95/);
  assert.match(errs('E10', { [UI]: '<Pressable android_ripple={{ color: ink }} onPressIn={down} />' }), /android_ripple/);
  assert.match(errs('E10', { [UI]: '<TouchableOpacity onPress={go} />' }), /TouchableOpacity dims/);
  assert.match(errs('E10', { [UI]: '<Pressable onPress={go}><Txt>Go</Txt></Pressable>' }), /shows nothing when the finger lands/);
  assert.equal(errs('E10', { [UI]: "<Pressable onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} hitSlop={12}>\n  <Animated.View style={[styles.box, pressed && styles.pressed]}>{children}</Animated.View>\n</Pressable>\nconst styles = StyleSheet.create({\n  box: { transform: [{ scale: 1 }], transitionProperty: 'transform' },\n  pressed: { transform: [{ scale: 0.97 }] },\n});\n<Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })} />" }), '');
});

test('motion E11: scale 0, a Zoom preset, or a scale value that starts or ends at 0 fails; 0.95 with opacity passes', () => {
  assert.match(errs('E11', { [UI]: 'const s = { opacity: 0, transform: [{ scale: 0 }] };' }), /scale: 0/);
  assert.match(errs('E11', { [UI]: '<Animated.View entering={ZoomIn} />' }), /ZoomIn scales/);
  assert.match(errs('E11', { [UI]: 'const scale = useSharedValue(0);' }), /scale starts at 0/);
  assert.match(errs('E11', { [UI]: 'iconScale.set(withTiming(0, { duration: motion.feedback }));' }), /iconScale goes to 0/);
  assert.equal(errs('E11', { [UI]: 'const scale = useSharedValue(0.95);\nconst s = { opacity: 0, transform: [{ scale: 0.97 }] };\nscale.set(withTiming(1, { duration: motion.select }));' }), '');
});

test('motion E12: a bouncing preset or curve fails; a plain fade passes', () => {
  assert.match(errs('E12', { [UI]: '<Animated.View entering={BounceIn} />' }), /BounceIn bounces/);
  assert.match(errs('E12', { [UI]: 'const e = Easing.elastic(1);' }), /Easing\.elastic bounces/);
  assert.equal(errs('E12', { [UI]: '<Animated.View entering={FadeIn} />' }), '');
});

test('motion E13: a file that moves things and never asks about Reduce Motion fails; one that asks, or only fades, passes', () => {
  assert.match(errs('E13', { [UI]: 'const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));' }), /never asks about Reduce Motion/);
  assert.match(errs('E13', { [UI]: '<Animated.View entering={SlideInDown} />' }), /never asks about Reduce Motion/);
  assert.match(errs('E13', { [UI]: "const box = { transitionProperty: 'transform', transitionDuration: motion.feedback };" }), /never asks about Reduce Motion/);
  assert.equal(errs('E13', { [UI]: 'const reduced = useReducedMotion();\nconst s = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : y.get() }] }));' }), '');
  assert.equal(errs('E13', { [UI]: 'const s = useAnimatedStyle(() => ({ opacity: o.get() }));\n<Animated.View entering={FadeIn} />' }), '');
});

test('motion E14: a target under 44 with too little hitSlop fails; hitSlop that reaches 44, or a token size of 44, passes', () => {
  const sheet = '\nconst styles = StyleSheet.create({ icon: { width: 32, height: 32 }, pill: { height: 40, paddingHorizontal: 20 } });';
  assert.match(errs('E14', { [UI]: `<Pressable style={styles.icon} onPressIn={down} />${sheet}` }), /is 32 tall to a finger/);
  assert.match(errs('E14', { [UI]: `<Pressable style={styles.icon} hitSlop={4} onPressIn={down} />${sheet}` }), /is 40 tall/);
  assert.match(errs('E14', { [UI]: `<Pressable style={styles.pill} hitSlop={{ vertical: 1 }} onPressIn={down} />${sheet}` }), /is 42 tall/);
  assert.equal(errs('E14', { [UI]: `<Pressable style={styles.icon} hitSlop={6} onPressIn={down} />\n<Pressable style={({ pressed }) => [styles.pill, pressed && styles.down]} hitSlop={{ top: 2, bottom: 2 }} />\n<Pressable style={{ height: size.controlMin }} />\n<Pressable style={style} />${sheet}` }), '');
});

test('motion E15: tabs that animate, a rewritten stack timing, or the JS stack fails; animation none and the native stack pass', () => {
  assert.match(errs('E15', { 'app/src/app/(tabs)/_layout.tsx': "<Tabs screenOptions={{ animation: 'shift', headerShown: false }} />" }), /animation 'shift'/);
  assert.match(errs('E15', { 'app/src/app/_layout.tsx': '<Stack screenOptions={{ animationDuration: 200 }} />' }), /animationDuration on <Stack>/);
  assert.match(errs('E15', { 'app/src/app/_layout.tsx': "import { createStackNavigator } from '@react-navigation/stack';" }), /JS stack/);
  assert.equal(errs('E15', { 'app/src/app/_layout.tsx': "<Tabs screenOptions={{ animation: 'none' }} />\n<Stack screenOptions={{ animation: reduced ? 'fade' : 'default' }} />" }), '');
});

test('motion E16: an entering animation on a virtualized row fails, inline or in a named render function; itemLayoutAnimation passes', () => {
  assert.match(errs('E16', { [UI]: '<FlatList data={items} renderItem={({ item }) => <Animated.View entering={FadeIn}><Tile item={item} /></Animated.View>} />' }), /<FlatList> gives its rows an entering/);
  assert.match(errs('E16', { [UI]: 'function renderRow({ item }) { return <Animated.View entering={FadeInDown}><Row item={item} /></Animated.View>; }\n<FlashList data={items} renderItem={renderRow} />' }), /<FlashList>/);
  assert.equal(errs('E16', { [UI]: 'const renderRow = ({ item }) => <Row item={item} />;\n<Animated.FlatList data={items} itemLayoutAnimation={ROW_CLOSE} renderItem={renderRow} />\n<Animated.View entering={FadeIn}><Header /></Animated.View>' }), '');
});

test('motion E17: transitionProperty all, or a transition that names no property, fails; a named property passes', () => {
  assert.match(errs('E17', { [UI]: "const box = { transitionProperty: 'all', transitionDuration: motion.select };" }), /'all' animates whatever/);
  assert.match(errs('E17', { [UI]: 'const styles = StyleSheet.create({ box: { transitionDuration: motion.feedback, transform: [{ scale: 1 }] } });' }), /no transitionProperty/);
  assert.equal(errs('E17', { [UI]: "const styles = StyleSheet.create({ box: { transitionProperty: ['transform', 'opacity'], transitionDuration: motion.feedback } });" }), '');
});

test('motion E18: an input under 16 or a locked zoom fails; type.t18 and an open viewport pass', () => {
  assert.match(errs('E18', { [UI]: '<TextInput style={{ fontSize: 15 }} />' }), /text at 15/);
  assert.match(errs('E18', { [UI]: '<TextInput style={type.t15} value={v} />' }), /text at 15/);
  assert.match(errs('E18', { [UI]: '<TextInput value={v} onChangeText={set} />' }), /text at 14 \(the default\)/);
  assert.match(errs('E18', { 'app/src/app/+html.tsx': '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />' }), /stops people zooming/);
  assert.equal(errs('E18', { [UI]: '<TextInput style={[type.t18, styles.field]} />\n<TextInput style={style} />', 'app/src/app/+html.tsx': '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />' }), '');
});

test('motion E19: an image with no size before it loads fails; a width and height, an aspect ratio, or a style from outside passes', () => {
  assert.match(errs('E19', { [UI]: '<Image source={item.photo} />' }), /no size before it loads/);
  assert.match(errs('E19', { [UI]: '<Image source={p} style={styles.photo} />\nconst styles = StyleSheet.create({ photo: { borderRadius: radius.photo } });' }), /no size before it loads/);
  assert.equal(errs('E19', { [UI]: "<Image source={p} style={{ width: 72, height: 72 }} />\n<Image source={p} style={{ aspectRatio: 1, width: '100%' }} />\n<Image source={p} style={style} />\n<Image source={p} width={72} height={72} />" }), '');
});

test('motion E20: initials from the first code unit fail; a grapheme passes, and server code is not read', () => {
  assert.match(errs('E20', { [UI]: 'const initial = name.charAt(0).toUpperCase();' }), /charAt\(0\)/);
  assert.match(errs('E20', { [UI]: "const initials = name.split(' ')[0][0];" }), /\[0\]\[0\]/);
  assert.equal(errs('E20', { [UI]: 'const initial = [...new Intl.Segmenter().segment(name)][0]?.segment;', 'app/src/edge/parse.ts': 'const c = line.charAt(0);' }), '');
});

test('motion E21: a count glued to a plural noun fails; a string per count passes', () => {
  assert.match(errs('E21', { [UI]: 'const line = `${offers.length} offers`;' }), /reads "1 offers"/);
  assert.match(errs('E21', { [UI]: '<Txt>{count} items</Txt>' }), /reads "1 items"/);
  assert.equal(errs('E21', { [UI]: "const line = `${count} ${count === 1 ? 'offer' : 'offers'}`;\n<Txt>{name} sells</Txt>" }), '');
});

test('motion E22: toFixed or a "$" glued to a number on screen fails; Intl.NumberFormat passes, and server code is not read', () => {
  assert.match(errs('E22', { [UI]: 'const price = `$${amount.toFixed(2)}`;' }), /toFixed/);
  assert.match(errs('E22', { [UI]: "const price = '$' + amount;" }), /"\$" glued/);
  assert.equal(errs('E22', { [UI]: "const price = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);", 'app/src/engines/money/ending.ts': 'const s = x.toFixed(2);' }), '');
});

test('motion rows: every check has a row held by motion.mjs and a test here, and every judge line starts "Fail if"', () => {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
  const rows = JSON.parse(readFileSync(join(root, '.agents/ui-rules.json'), 'utf8')).filter(r => /^E\d+$/.test(r.id));
  const mine = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  for (const id of Object.keys(MOTION)) {
    const row = rows.find(r => r.id === id);
    assert.equal(row?.kind, 'check', `${id} has no check row in .agents/ui-rules.json`);
    assert.equal(row.by, '.agents/checks/motion.mjs', `${id} is held by ${row.by}`);
    assert.ok(mine.includes(`'motion ${id}:`), `${id} has no test named "motion ${id}:"`);
  }
  for (const r of rows) {
    assert.match(r.source ?? '', /^Emil Kowalski, /, `${r.id} names no source`);
    if (r.kind === 'check') assert.ok(MOTION[r.id], `${r.id} is a check row with no check in motion.mjs`);
    else assert.match(r.fail ?? '', /^Fail if /, `${r.id} is a judge line that does not start "Fail if"`);
  }
});
