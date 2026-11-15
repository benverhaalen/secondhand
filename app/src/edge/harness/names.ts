// The site and verb names, in their own module so protocol.ts and platform.ts can both read them without a cycle.
export const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari', 'offerup', 'grailed'] as const;
export type Site = (typeof SITES)[number];

export const VERBS = ['post', 'revise', 'end', 'relist', 'read_listings', 'read_inbox', 'send_message', 'read_offers',
  'answer_offer', 'make_offer', 'read_orders', 'read_stats', 'read_storefront', 'search', 'save'] as const;
export type Verb = (typeof VERBS)[number];
