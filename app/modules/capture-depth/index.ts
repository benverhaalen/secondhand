import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { createElement, useRef } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
import { log } from '../../src/ui/log.ts';

export type DeviceCapabilities = { has_lidar: boolean; object_capture: boolean };
export type Extent = {
  extent_cm: { width: number; depth: number; height: number };
  extent_conf: 0;
  rigid: true;
  frames: number;
  distance_m: number | null;
};
export type CaptureDepthError = { code: string };
export type CaptureDepthStatus =
  | { state: 'distance'; distance_m: number | null }
  | { state: 'requesting_camera_permission' | 'unsupported' | 'running' | 'waiting_for_depth'
      | 'insufficient_geometry' | 'item_clipped' | 'paused' | 'interrupted' | 'interruption_ended' };
export type CaptureDepthViewProps = ViewProps & {
  onExtent?: (event: NativeSyntheticEvent<Extent>) => void;
  onError?: (event: NativeSyntheticEvent<CaptureDepthError>) => void;
  onStatus?: (event: NativeSyntheticEvent<CaptureDepthStatus>) => void;
};
type NativeProps = CaptureDepthViewProps & { onStatus: (event: NativeSyntheticEvent<CaptureDepthStatus>) => void };
type CaptureDepthModule = { capabilities(): Promise<DeviceCapabilities> };

const native = requireOptionalNativeModule<CaptureDepthModule>('CaptureDepth');
const NativeView = native ? requireNativeView<NativeProps>('CaptureDepth') : null;

export async function capabilities(): Promise<DeviceCapabilities> {
  if (!native) return { has_lidar: false, object_capture: false };
  return log.call('native', 'CaptureDepth.capabilities', {}, () => native.capabilities());
}

export function CaptureDepthView(props: CaptureDepthViewProps) {
  if (!NativeView) return null;
  const lastLoggedExtent = useRef<Extent['extent_cm'] | undefined>(undefined);
  return createElement(NativeView, {
    ...props,
    onStatus: (event: NativeSyntheticEvent<CaptureDepthStatus>) => {
      if (event.nativeEvent.state !== 'distance') {
        log.note('capture depth session', { state: event.nativeEvent.state });
      }
      props.onStatus?.(event);
    },
    onExtent: (event: NativeSyntheticEvent<Extent>) => {
      const extent = event.nativeEvent.extent_cm, previous = lastLoggedExtent.current;
      if (!previous || Math.abs(extent.width - previous.width) >= 0.5
          || Math.abs(extent.depth - previous.depth) >= 0.5
          || Math.abs(extent.height - previous.height) >= 0.5) {
        lastLoggedExtent.current = { ...extent };
        log.note('capture depth frame measured', { frames: event.nativeEvent.frames, extent_conf: 0, extent_cm: extent });
      }
      props.onExtent?.(event);
    },
    onError: (event: NativeSyntheticEvent<CaptureDepthError>) => {
      log.error('CaptureDepth', new Error(event.nativeEvent.code));
      props.onError?.(event);
    },
  });
}
