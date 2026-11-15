import { ThemeToggle } from '../../components/chrome';
import { Conversation } from '../../components/conversation';
export const metadata = { title: 'Buy · secondhand' };
export default function Buy() {
  return <main id="main" className="buy-page"><div className="buy-heading"><h1>Find your next thing.</h1><ThemeToggle /></div><Conversation /></main>;
}
