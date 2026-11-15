// The camera feed's stand-in on the web and in renders: generated photos of the jacket (features/capture/design/feed,
// lineage there), never shown as a real listing. Kept apart from capture.ts so the data loads in node tests.
import type { ImageSourcePropType } from 'react-native';
import type { FeedKey } from './capture.ts';

const FEED: Record<FeedKey, ImageSourcePropType> = {
  front: require('../../assets/demo/feed/feed-front.jpg'),
  turn: require('../../assets/demo/feed/feed-turn.jpg'),
  tag: require('../../assets/demo/feed/feed-tag.jpg'),
  back: require('../../assets/demo/feed/feed-back.jpg'),
};
export const feed = (key: FeedKey): ImageSourcePropType => FEED[key];
