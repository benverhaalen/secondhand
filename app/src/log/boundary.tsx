import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { AppState, Button, Platform, Text, View } from 'react-native';
import { createNativeRecorder } from '../../../log/native.js';

export const recorder = createNativeRecorder({ Constants, File, Paths, AppState, Platform });

class CrashBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { recorder.recordError(error, true, info.componentStack ?? ''); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Something went wrong</Text>
      <Button title="Retry" onPress={() => this.setState({ failed: false })} />
    </View>;
  }
}
function CrashRoute() {
  const path = usePathname();
  useEffect(() => recorder.setRoute(path), [path]);
  return null;
}
export function crashBoundary(content: ReactNode) {
  return <CrashBoundary><CrashRoute />{content}</CrashBoundary>;
}
