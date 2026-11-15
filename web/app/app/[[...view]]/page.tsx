import { notFound } from 'next/navigation';
import { Today, Sell, ItemDetail } from '../../../components/desktop/sell';
import { Buy } from '../../../components/desktop/buy';
import { Sales } from '../../../components/desktop/sales';
import { You } from '../../../components/desktop/you';
import { Messages } from '../../../components/desktop/messages';
export default async function Page({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view = [] } = await params;
  if (!view.length) return <Today />;
  if (view.length === 1 && view[0] === 'sell') return <Sell />;
  if (view.length === 2 && view[0] === 'sell' && view[1] === 'sales') return <Sales />;
  if (view.length === 2 && view[0] === 'sell') return <ItemDetail id={view[1]} />;
  if (view.length === 1 && view[0] === 'buy') return <Buy />;
  if (view.length === 1 && view[0] === 'you') return <You />;
  if (view[0] === 'messages' && view.length <= 2) return <Messages id={view[1]} />;
  notFound();
}
