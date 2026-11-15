import type { Turn as TurnState } from '../lib/events';
import type { ToolCallInfo } from '../lib/types';
import { number } from '../lib/widgets';
import { Sources, Widget } from './widgets';
import { Photo } from './photo';
import { log } from '../lib/log';

const toolNames: Record<ToolCallInfo['tool'], string> = { search_market: 'Finding listings', value_item: 'Checking sold prices', price_trend: 'Checking price history', where_to_list: 'Comparing sites', market_store: 'Reading market data', web_search: 'Searching the web' };
const siteNames: Record<string, string> = { poshmark: 'Poshmark', mercari: 'Mercari', ebay: 'eBay', depop: 'Depop', dupe: 'Dupe', facebook: 'Facebook Marketplace' };
const errors = { rate_limited: 'Too many asks. Wait a moment, then try again.', offline: 'You’re offline. Reconnect to send your ask.', failed: 'The answer failed. Try again.' };
export function Turn({ turn, retry }: { turn: TurnState; retry?: () => void }) {
  const error = turn.status === 'rate_limited' || turn.status === 'offline' || turn.status === 'failed' ? errors[turn.status] : null;
  const resultEntries = Object.entries(turn.answer?.results ?? {}).filter(([, r]) => !r.widgets.every(w => w === 'sources'));
  const comparableSales = Object.values(turn.answer?.results ?? {}).find(r => r.reason === 'too_few')?.counts.count;
  return <article className="turn" data-state={turn.status} aria-label={`Ask: ${turn.text}`}>
    {turn.recorded && <p className="recorded">Recorded answer <span>· Fixture prices and counts</span></p>}
    <div className="ask"><span className="muted">You</span>{turn.photo && <Photo src={turn.photo} alt="Your attached garment" className="ask-photo" />}<p>{turn.text || 'Find this item'}</p></div>
    <div className="answer">
      <ul className="tool-lines" aria-label="Sources checked">{turn.tools.map(tool => {
        const counts = Object.entries(tool.counts);
        return <li key={tool.id} data-phase={tool.phase}>{tool.phase === 'start' ? <><span className="progress-dot" aria-hidden="true" />{toolNames[tool.tool]}</> : <><span aria-hidden="true">✓</span><span>{counts.length ? counts.map(([site, value]) => `${siteNames[site] ?? (site === 'count' ? toolNames[tool.tool] : site)} · ${number(value)} ${tool.tool === 'search_market' ? 'listings' : 'results'}`).join(' · ') : toolNames[tool.tool]} · {number(tool.ms / 1000)} s{!tool.ok ? ' · Unavailable' : ''}</span></>}</li>;
      })}</ul>
      {turn.status === 'running' && !turn.tools.length && !turn.streamed && <p className="muted running-line">Finding an answer…</p>}
      {turn.status === 'thin_data' && <p className="notice">Too few comparable sales{comparableSales != null && ` · ${number(comparableSales)} found` }</p>}
      {turn.status === 'refused' && <p className="notice">Cannot answer</p>}
      {turn.streamed && !turn.answer && <p className="streamed">{turn.streamed}</p>}
      {turn.answer && <div className="answer-blocks">{turn.answer.blocks.map((block, i) => block.type === 'text' ? <p className="answer-text" key={i}>{block.text}</p> : <Widget key={i} block={block} results={turn.answer!.results} />)}</div>}
      {error && <div className="error" role="status"><p>{error}</p><button type="button" className="secondary" onClick={retry} disabled={!retry}>Try again</button></div>}
      {turn.answer && (resultEntries.length > 0 || turn.answer.sources.length > 0) && <footer className="evidence">{resultEntries.length > 0 && <details onToggle={event => log.input('buy', 'basis.disclose', { open: event.currentTarget.open })}><summary>Measured by us</summary><ul>{resultEntries.map(([id, result]) => <li key={id}><p>{result.basis}</p>{result.not_built.map((line, i) => <p className="muted" key={i}>{line}</p>)}<span className="muted">{result.as_of}</span></li>)}</ul></details>}{turn.answer.sources.length > 0 && <details onToggle={event => log.input('buy', 'sources.disclose', { open: event.currentTarget.open })}><summary>From the web</summary><Sources sources={turn.answer.sources} /></details>}</footer>}
    </div>
  </article>;
}
