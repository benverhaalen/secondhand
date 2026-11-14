# The website

Raised by Ben, 20:45 and 20:59: "app first, website if we have time" ([words](../product/words.md#2026-11-14-app-first-website-if-time), [20:45](../product/words.md#2026-11-14-app-first-and-ui-factory-after-the-brand)). Decided as "the phone app comes first, a website follows" ([decision](../product/decisions.md#2026-11-14-the-phone-app-comes-first-a-website-follows)).

**Waits on:** the phone app working end to end.

## What it is

A website with sign-in that does the same things as the app, except the phone-only ones. There is no guided camera or LiDAR measuring; you upload photos instead.

## What already exists

- The approval screens render from json-render catalogs, and the same catalogs have a web renderer ([decision](../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)).
- Measuring on the web uses a card in the photo for scale; it was marked "only if there's time" ([seeing-the-item-pipeline.md](../research/cross-cutting/ben/seeing-the-item-pipeline.md)).
- Databricks Apps takes only Databricks sign-in, which is still open for the phone too ([vision, Open](../product/vision.md#open)).

## First step

Render the existing catalogs with the web renderer behind sign-in, with photo upload in place of the camera.
