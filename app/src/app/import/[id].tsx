import { useLocalSearchParams } from 'expo-router';
import { Archive } from '@/account/archive';
export default function ImportArchive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Archive accountId={id} />;
}
