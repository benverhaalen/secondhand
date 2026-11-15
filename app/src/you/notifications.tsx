import { List, Nav, Screen, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { useGo } from './state';

export function Notifications() {
  const go = useGo();
  return (
    <Screen name="you-notifications" state="typical" nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">Notifications</Txt>
      <List>
        <ListRow id="notify-messages" lead="inbox" label="Messages" detail="All alerts and updates arrive here." onPress={() => go.to('/messages')} />
      </List>
    </Screen>
  );
}
