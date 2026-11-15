type Marketplace = {
  name: string;
  hosts: string[];
  listing: RegExp;
  ios: string;
  android?: string;
};

const marketplaces: Marketplace[] = [
  { name: 'eBay', hosts: ['ebay.com', 'www.ebay.com', 'm.ebay.com'], listing: /^\/itm\/(?!like\/)[^/]+/, ios: '282614216', android: 'com.ebay.mobile' },
  { name: 'Depop', hosts: ['depop.com', 'www.depop.com'], listing: /^\/products\/[^/]+/, ios: '518684914', android: 'com.depop' },
  { name: 'Poshmark', hosts: ['poshmark.com', 'www.poshmark.com'], listing: /^\/listing\/[^/]+/, ios: '470412147', android: 'com.poshmark.app' },
  { name: 'Mercari', hosts: ['mercari.com', 'www.mercari.com'], listing: /^\/us\/item\/[^/]+/, ios: '896130944', android: 'com.mercariapp.mercari' },
  { name: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'], listing: /^\/marketplace\/item\/[^/]+/, ios: '284882215', android: 'com.facebook.katana' },
  { name: 'OfferUp', hosts: ['offerup.com', 'www.offerup.com'], listing: /^\/item\/detail\/[^/]+/, ios: '468996152', android: 'com.offerup' },
  { name: 'Grailed', hosts: ['grailed.com', 'www.grailed.com'], listing: /^\/listings\/[^/]+/, ios: '1061302787' },
];

export function marketplaceDestination(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('This listing does not have a valid website link.');
  const marketplace = url.protocol === 'https:' && !url.port
    && url.searchParams.get('ul_noapp') !== '1' && url.hash !== '#ul_noapp' && url.searchParams.get('ul_off') !== 'true'
    ? marketplaces.find(site => site.hosts.includes(url.hostname) && site.listing.test(url.pathname)) : undefined;
  return { url: value, marketplace };
}
