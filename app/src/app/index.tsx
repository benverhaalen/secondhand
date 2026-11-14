import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isHealth, type Health } from '@/health';

// Development placeholder until the first real screen lands: shows whether the backend answers.
export default function Index() {
  const [health, setHealth] = useState<Health | 'loading' | 'unreachable'>('loading');
  useEffect(() => {
    fetch('/v1/health').then(r => r.json()).then((h: unknown) => setHealth(isHealth(h) ? h : 'unreachable'), () => setHealth('unreachable'));
  }, []);
  return (
    <View style={styles.container}>
      <Text>secondhand</Text>
      <Text>{line(health)}</Text>
    </View>
  );
}

function line(h: Health | 'loading' | 'unreachable') {
  if (h === 'loading') return 'Checking Databricks';
  if (h === 'unreachable') return 'The server did not answer';
  return h.ok ? `Databricks connected: ${h.catalog}, ${h.at}` : `Databricks not ready: ${h.state}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
