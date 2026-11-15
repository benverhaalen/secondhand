# Marketplace listing links

`src/navigation/open-marketplace.ts` opens the original listing URL. It never rewrites a listing into a search, drops referral parameters, or sends an unknown domain to a marketplace app.

On the web, the listing opens in a separate tab. In a rebuilt native app, iOS tries a universal link with `universalLinksOnly`. Android tries the same HTTPS URL in the marketplace's verified package. A failed attempt offers **Get app**, **Open website**, and **Cancel**. Failure means the app could not handle that link; it does not prove the app is missing. Choosing the website opens a browser view with the original URL.

Expo Go and existing builds without this optional module offer **Open listing** or **Get app**. Their normal HTTPS handler may open an installed app or the browser. Search, account, message, unknown-domain and unrecognized listing routes retain normal HTTPS handling. No installed-app inventory or custom URL schemes are used.

## Native build

The local module must be included in a new iOS or Android build. A JavaScript update alone cannot add it. Expo autolinking discovers it under `app/modules`; rebuild the development client or release using the project's existing build workflow. Existing builds remain usable through the fallback above.

## Verified destinations

These official store records were checked on November 15, 2026. Host and listing-path matching is deliberately explicit; other hosts and routes keep the original HTTPS destination.

| Marketplace | Apple App Store | Google Play / Android package |
| --- | --- | --- |
| eBay | [282614216](https://apps.apple.com/us/app/ebay-online-shopping-selling/id282614216) | [com.ebay.mobile](https://play.google.com/store/apps/details?id=com.ebay.mobile) |
| Depop | [518684914](https://apps.apple.com/us/app/depop-buy-sell-clothes/id518684914) | [com.depop](https://play.google.com/store/apps/details?id=com.depop) |
| Poshmark | [470412147](https://apps.apple.com/us/app/poshmark-shop-sell-fashion/id470412147) | [com.poshmark.app](https://play.google.com/store/apps/details?id=com.poshmark.app) |
| Mercari US | [896130944](https://apps.apple.com/us/app/mercari-buying-selling-app/id896130944) | [com.mercariapp.mercari](https://play.google.com/store/apps/details?id=com.mercariapp.mercari) |
| Facebook | [284882215](https://apps.apple.com/us/app/facebook/id284882215) | [com.facebook.katana](https://play.google.com/store/apps/details?id=com.facebook.katana) |
| OfferUp | [468996152](https://apps.apple.com/us/app/offerup-buy-sell-marketplace/id468996152) | [com.offerup](https://play.google.com/store/apps/details?id=com.offerup) |
| Grailed | [1061302787](https://apps.apple.com/us/app/grailed-buy-sell-fashion/id1061302787) | No current official Android destination verified; HTTPS only. |

The OS decides whether the exact URL can open in an installed app. eBay and Poshmark also publish readable [eBay associations](https://www.ebay.com/.well-known/apple-app-site-association) and [Poshmark associations](https://poshmark.com/.well-known/apple-app-site-association). The other marketplace association files could not all be retrieved during this audit. A verified store identity is not proof that every route opens inside that app. Installed-device behavior still needs a rebuilt native app audit.

Platform references: [Apple universalLinksOnly](https://developer.apple.com/documentation/uikit/uiapplication/openexternalurloptionskey/universallinksonly), [Android package visibility and explicit intents](https://developer.android.com/training/package-visibility/use-cases), [React Native Linking](https://reactnative.dev/docs/linking), and [Expo local modules](https://docs.expo.dev/modules/get-started/).
