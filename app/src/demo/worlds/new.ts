// Just installed: signed in with Apple a minute ago, no site linked, nothing to sell, nothing bought.
// Today shows only the next setup step; every list is empty.
import { inMinutes } from '../format.ts';
import { PRODUCTS, RETAIL } from '../market.ts';
import type { Site } from '../types.ts';
import type { World } from '../world.ts';

const SITES: Site[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];

export const fresh: World = {
  name: 'new', now: inMinutes(0),
  user: {
    id: 'usr_new', name: '', locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', last_open_at: null,
    auth_methods: [{ provider: 'apple', linked_at: inMinutes(-1) }],
    onboarding: { done_steps: ['signed_in'], finished_at: null },
    notification_pref: [], experiments_consent: false,
  },
  connections: SITES.map(site => ({ site, account: null, linking: null, error: null })),
  items: [], offers: [], orders: [], appointments: [], conversations: [], messages: [], decisions: [], notices: [], events: [], rules: [],
  limits: { handover: ['ship', 'pickup'], pickup_windows: [], saved_spot: null, ask_every_time: true },
  goal: null, style: [], wants: [], matches: [], products: PRODUCTS, searches: [], retail: RETAIL,
};
