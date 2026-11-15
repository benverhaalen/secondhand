import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { createElement } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
import { log } from '../../src/ui/log.ts';

export type DeviceCapabilities = { has_lidar: boolean; object_capture: boolean };
export type Extent = {
  extent_cm: { width: number; depth: number; height: number };
  extent_conf: 0;
  rigid: true;
  frames: number;
};
export type CaptureDepthError = { code: string };
export type CaptureDepthViewProps = ViewProps & {
  onExtent?: (event: NativeSyntheticEvent<Extent>) => void;
  onError?: (event: NativeSyntheticEvent<CaptureDepthError>) => void;
};
type Status = { state: string };
type NativeProps = CaptureDepthViewProps & { onStatus: (event: NativeSyntheticEvent<Status>) => void };
type CaptureDepthModule = { capabilities(): Promise<DeviceCapabilities> };

const native = requireOptionalNativeModule<CaptureDepthModule>('CaptureDepth');
const NativeView = native ? requireNativeView<NativeProps>('CaptureDepth') : null;

export async function capabilities(): Promise<DeviceCapabilities> {
  if (!native) return { has_lidar: false, object_capture: false };
  return log.call('native', 'CaptureDepth.capabilities', {}, () => native.capabilities());
}

export function CaptureDepthView(props: CaptureDepthViewProps) {
  if (!NativeView) return null;
  return createElement(NativeView, {
    ...props,
    onStatus: ({ nativeEvent }: NativeSyntheticEvent<Status>) => {
      log.note('capture depth session', { state: nativeEvent.state });
    },
    onExtent: (event: NativeSyntheticEvent<Extent>) => {
      log.note('capture depth frame measured', { frames: event.nativeEvent.frames, extent_conf: 0 });
      props.onExtent?.(event);
    },
    onError: (event: NativeSyntheticEvent<CaptureDepthError>) => {
      log.error('CaptureDepth', new Error(event.nativeEvent.code));
      props.onError?.(event);
    },
  });
}
