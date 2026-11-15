// Every word on screen goes through this, so size and tone come from the brand and nowhere else.
// The typefaces are not loaded yet: the brand has not picked them.
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { color, type } from './tokens.generated';

const ROLE = { caption: type.t13, body: type.t15, headline: type.t18, heading: type.t36, amount: type.t50 } as const;

export function Txt({ role = 'body', quiet = false, children }: { role?: keyof typeof ROLE; quiet?: boolean; children: ReactNode }) {
  return <Text style={[ROLE[role], { color: quiet ? color.ink2 : color.ink }]}>{children}</Text>;
}
