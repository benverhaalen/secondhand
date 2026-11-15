import { Conversation } from '../../components/conversation';
import { reviewStates } from '../../lib/fixtures';
export const metadata = { title: 'States · secondhand', robots: { index: false, follow: false } };
export default function States() {
  return <main id="main" className="states-page"><h1>Conversation states</h1><p className="muted">Recorded answers. All prices, counts and sources here are fixtures.</p><nav className="state-nav" aria-label="Conversation states">{reviewStates.map(state => <a key={state.name} href={`#${state.name}`}>{state.name.replaceAll('_', ' ')}</a>)}</nav>{reviewStates.map(state => <section key={state.name} id={state.name} className="state-section" data-state={state.name}><h2>{state.name.replaceAll('_', ' ')}</h2><p className="recorded">Recorded answer</p><Conversation review initialTurns={state.turns} initialDraft={state.draft} initialPhoto={state.photo} /></section>)}</main>;
}
