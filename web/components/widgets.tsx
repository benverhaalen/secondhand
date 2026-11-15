import type { Block, ToolResult, WebSource } from '../lib/types';
import { widgetRows, safeUrl, money, number, percent, priceBand, type Row } from '../lib/widgets';
import { Photo } from './photo';
import { log } from '../lib/log';

function first(row: Row, ...keys: string[]) { return keys.map(k => row[k]).find(v => v !== undefined && v !== null); }
function amount(row: Row, ...keys: string[]) {
  const value = first(row, ...keys);
  return typeof value === 'string' ? value : money(value);
}
const count = (row: Row, result: ToolResult) => number(first(row, 'count', 'basis_count', 'n', 'n_eff') ?? result.counts.count ?? result.counts.n_eff);
const label = (value: unknown) => value === undefined || value === null ? 'Not available' : String(value);
export function Sources({ sources }: { sources: WebSource[] }) {
  return <ul className="sources">{sources.map((source, i) => {
    const url = safeUrl(source.url);
    if (!url) return null;
    return <li key={`${url}-${i}`}><a href={url} target="_blank" rel="noopener noreferrer" onClick={() => log.input('buy', 'source.open')}><span>{new URL(url).hostname}</span><span>{source.title}</span><span className="muted">{source.page_age ?? 'Date unavailable'}</span></a></li>;
  })}</ul>;
}
export function Widget({ block, results }: { block: Extract<Block, { type: 'widget' }>; results: Record<string, ToolResult> }) {
  const result = results[block.result_id];
  const rows = widgetRows(block, results);
  if (!result || !rows.length) return <p className="muted widget" data-widget={block.widget}>No data for this part of the answer.</p>;
  const row = rows[0];
  if (block.widget === 'price_range') {
    const band = priceBand(row);
    if (!result.ok || !band) return <p className="muted widget">No price estimate · {count(row, result)} sales</p>;
    const position = band.position;
    return <figure className="widget" data-widget="price_range"><figcaption>Similar sold prices <span className="muted">· {count(row, result)} sales</span></figcaption><div className="price-band" role="img" aria-label={`Sold prices ${amount(row, 'q10_cents', 'q10')} to ${amount(row, 'q90_cents', 'q90')}; middle price ${amount(row, 'q50_cents', 'q50')}`}><div className="band" /><span className="median-mark" style={{ insetInlineStart: `${position}%` }} /></div><div className="spread numbers"><span>{amount(row, 'q10_cents', 'q10')}</span><span>Middle {amount(row, 'q50_cents', 'q50')}</span><span>{amount(row, 'q90_cents', 'q90')}</span></div></figure>;
  }
  if (block.widget === 'price_trend') return <figure className="widget" data-widget="price_trend"><figcaption>Sold prices over time</figcaption><div className="trend"><div><span className="muted">Prior middle price</span><span className="amount">{amount(row, 'p50_prior_cents', 'p50_prior')}</span></div><span aria-hidden="true">→</span><div><span className="muted">Recent middle price</span><span className="amount">{amount(row, 'p50_recent_cents', 'p50_recent')}</span></div></div><p className="muted">{percent(row.change)} change · {count(row, result)} sales</p></figure>;
  if (block.widget === 'sites') return <div className="widget" data-widget="sites"><h3>Where to sell</h3><div className="table-wrap" tabIndex={0} role="region" aria-label="Where to sell comparison"><table><thead><tr><th>Site</th><th>You get</th><th>Sale in 30 days</th><th>Days to sell</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{label(r.site)}</th><td>{amount(r, 'keep_cents', 'keep')}</td><td>{percent(first(r, 'p_sale_30', 'p_sale_30d', 'p_sale'))}</td><td>{number(first(r, 'days_to_sell', 'days'))}</td></tr>)}</tbody></table></div></div>;
  if (block.widget === 'listings' || block.widget === 'alternatives') return <div className="widget" data-widget={block.widget}><h3>{block.widget === 'listings' ? 'Found for you' : 'Similar styles'}</h3><div className="listing-grid">{rows.map((r, i) => {
    const url = safeUrl(r.url);
    const content = <><Photo src={String(first(r, 'image_url', 'photo_url', 'image') ?? '')} alt={label(r.title)} /><div className="listing-copy"><span>{label(r.title)}</span><span className="numbers">{amount(r, 'price_cents', 'price')}</span><span className="muted">{label(r.site)} · {label(r.condition)}</span><span className="outbound">{url ? 'View listing →' : 'Link unavailable'}</span></div></>;
    return url ? <a className="listing" key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={() => log.input('buy', 'listing.open')} data-item>{content}</a> : <div className="listing" key={i} data-item>{content}</div>;
  })}</div></div>;
  if (block.widget === 'sources') return <div className="widget" data-widget="sources"><h3>Web sources</h3><Sources sources={rows.map(r => ({ title: label(r.title), url: String(r.url ?? ''), page_age: String(first(r, 'date', 'page_age', 'as_of') ?? 'Date unavailable') }))} /></div>;
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== 'sql');
  const sql = [...new Set(rows.map(r => r.sql).filter((v): v is string => typeof v === 'string'))];
  return <div className="widget" data-widget="table"><h3>Market data</h3><div className="table-wrap" tabIndex={0} role="region" aria-label="Market data"><table><thead><tr>{columns.map(k => <th key={k}>{k.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{columns.map(k => <td key={k}>{k.endsWith('_cents') ? money(r[k]) : label(r[k])}</td>)}</tr>)}</tbody></table></div><details onToggle={event => log.input('buy', 'sql.disclose', { open: event.currentTarget.open })}><summary>View SQL</summary><pre>{sql.length ? sql.join('\n\n') : 'SQL was not returned.'}</pre></details></div>;
}
