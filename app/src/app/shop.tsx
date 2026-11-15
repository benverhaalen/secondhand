// /shop: Buy's field pressed (Nate, words.md 2026-11-15): the page turns white with the field focused, the search builds
// as each source lands, then it is a chat kept on this device. ?q= runs that ask on open. The wiring is
// app/src/buy/chat/use-shop.ts; the look is app/src/buy/chat/shop-view.tsx. States and controls: app/behavior/shop.json.
import '@/buy/chat/device-store';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { ShopView } from '@/buy/chat/shop-view';
import { useShop } from '@/buy/chat/use-shop';
import { log, Theme } from '@/ui';

export default function Shop() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const shop = useShop();
  const asked = useRef(false);
  useEffect(() => { if (q && !asked.current) { asked.current = true; shop.ask(q); } }, [q, shop]);
  const close = () => { shop.close(); if (router.canGoBack()) router.back(); else router.replace('/buy'); };
  const open = (url: string, id: string) => Linking.openURL(url).then(() => undefined, e => { log.error('shop.open_site', e, { result: id }); });
  return (
    // White with black type, whatever the phone's mode (Nate, words.md 2026-11-15: "turning everything in the background white").
    <Theme scheme="light">
      <Stack.Screen options={{ animation: 'fade', headerShown: false }} />
      <ShopView skip="empty, one, dense: a search answer says itself how many it found; offline: a search that cannot reach the server is failed"
        phase={shop.phase} state={shop.failure && shop.phase !== 'chat' ? 'failed' : shop.phase} turns={shop.turns} failure={shop.failure} saved={shop.saved}
        offer={shop.offer} onAskOffered={shop.askOffered} off={shop.off} onToggleSource={shop.toggleSource}
        onAsk={shop.ask} onClose={close} onOpen={open} onReopen={shop.reopen} onRetry={shop.retry} />
    </Theme>
  );
}
