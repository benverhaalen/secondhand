// The one search box on the buy side (pages §6.12): words, a pasted link, or the camera, in one field, as Amazon's and
// eBay's search boxes are. Why a part: Buy, Search results and the website all start here, and a box drawn by each
// screen would drift. 48 tall like every full-width control (Art. 7.8), a capsule, gray on the page with no line (L5).
// States: empty (the placeholder in second ink), filled (the words in ink), editing (a text input in place, 18 so iOS
// never zooms), and working (the search runs: a small spinner where the camera was, so nothing moves, U7).
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { FACE } from '../fonts';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space, type, weight } from '../tokens.generated';
import { IconButton } from './buttons';
import { mark } from './mark';

export function SearchField({ id, value = '', placeholder, working = false, onSubmit, onCamera }: {
  id: string;
  // What was searched, when the page shows a search already run.
  value?: string;
  // What can go in: "Find an item or paste a link".
  placeholder: string;
  working?: boolean;
  onSubmit?: (text: string) => void;
  // The camera finds the thing from a photo; without it the field has no camera.
  onCamera?: () => void;
}) {
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const submit = () => { setEditing(false); const t = draft.trim(); if (t) onSubmit?.(t); };
  const box = { height: size.buttonH, borderRadius: radius.pill, backgroundColor: c.gray, flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingLeft: space.s4, paddingRight: space.s1 } as const;
  const trail = (
    <View style={{ width: size.pillCardH, height: size.pillCardH, alignItems: 'center', justifyContent: 'center' }}>
      {working ? <ActivityIndicator size="small" color={c.ink2} /> : onCamera ? <IconButton id={`${id}-camera`} icon="camera-01" label="Search with a photo" look="plain" onPress={onCamera} /> : null}
    </View>
  );
  return (
    <View {...mark('search-field', { state: working ? 'working' : editing ? 'editing' : value ? 'filled' : 'empty' })} style={box}>
      <Icon name="search-01" size={20} tone="ink-2" />
      <View style={{ flex: 1, height: size.buttonH, justifyContent: 'center' }}>
        {editing ? (
          <TextInput
            testID={`${id}-input`}
            accessibilityLabel={placeholder}
            autoFocus
            value={draft}
            placeholder={placeholder}
            placeholderTextColor={c.ink2}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            onBlur={() => setEditing(false)}
            returnKeyType="search"
            autoCorrect={false}
            style={{ fontSize: Math.max(16, type.t18.fontSize), lineHeight: type.t18.lineHeight, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink, padding: 0, outlineStyle: 'none' } as object}
          />
        ) : (
          <Press id={id} label={value ? `Search: ${value}` : placeholder} onPress={() => { setDraft(value); setEditing(true); }} round={false} hit={{ top: 4, bottom: 4 }}>
            <View style={{ height: size.buttonH, justifyContent: 'center', backgroundColor: c.gray }}>
              <Txt role="headline" tone={value ? 'ink' : 'ink-2'} lines={1}>{value || placeholder}</Txt>
            </View>
          </Press>
        )}
      </View>
      {trail}
    </View>
  );
}
