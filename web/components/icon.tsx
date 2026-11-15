import { createElement } from 'react';
import { ICONS, type IconName } from '../lib/icons.generated';

export function Icon({ name, size = 24, className }: {
  name: IconName;
  size?: 16 | 20 | 24;
  className?: string;
}) {
  return <svg className={className ? `brand-icon ${className}` : 'brand-icon'} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name].map(([tag, props], index) => createElement(tag, { ...props, key: index }))}
  </svg>;
}
