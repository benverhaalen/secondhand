import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { asks, dots, doubleSale, halfLife, keeps, markets, range, rules, skipped } from './example';
import { Motion } from './motion';
import styles from './engine.module.css';

export const metadata: Metadata = {
  title: 'Engine · secondhand',
  description: 'How secondhand turns a photo into a price: selling, buying, how sales are weighed, and the Databricks pipeline behind it.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const usd = (cents: number, digits = 0) => `$${(cents / 100).toFixed(digits)}`;
const logo = (site: string) => `/marketing/platforms/${site.replace('_local', '')}.png`;
const siteName: Record<string, string> = { ebay: 'eBay', depop: 'Depop', poshmark: 'Poshmark', mercari: 'Mercari', facebook: 'Facebook Marketplace', facebook_local: 'Facebook Marketplace, local pickup' };

function SourceLink({ path, children }: { path: string; children: React.ReactNode }) {
  return <a className={styles.link} href={`${repo}${path}`}>{children} <Icon name="arrow-right-01" size={16} /></a>;
}
function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return <li data-step><h3>{title}</h3><p>{children}</p></li>;
}
function Box({ n, x, y, w, h = 40, title, sub, accent }: { n: string; x: number; y: number; w: number; h?: number; title: string; sub?: string; accent?: boolean }) {
  return <g data-n={n}>
    <rect x={x} y={y} width={w} height={h} rx={10} data-k={accent ? 'box-accent' : 'box'} />
    <text x={x + w / 2} y={sub ? y + h / 2 - 2 : y + h / 2 + 4} textAnchor="middle">{title}</text>
    {sub && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" data-k="sub">{sub}</text>}
  </g>;
}
const Edge = ({ n, d }: { n: string; d: string }) => <path data-n={n} data-k="edge" d={d} pathLength={1} />;

/* ---------- selling ---------- */
const facts = [
  { label: 'Kind', value: 'Pants', region: [30, 62, 154, 80] },
  { label: 'Color', value: 'Black, faded', region: [64, 70, 44, 28] },
  { label: 'Detail', value: 'Carpenter pockets', region: [34, 118, 24, 20] },
] as const;
const priceX = (cents: number) => 16 + (cents - 2000) / 4000 * 368;

function SellFigure() {
  return <svg className={styles.fig} viewBox="0 0 400 520" role="img" aria-label={`One photo of black carpenter pants. Kind, color and pockets are each read from a marked part of the photo; the brand is left empty until a label photo is added. Similar ones sold for ${usd(range.q10)} to ${usd(range.q90)}. On a ${usd(range.q50)} sale you would keep ${keeps.map(k => `${usd(k.keep_cents, 2)} on ${siteName[k.site]}`).join(', ')}.`}>
    <defs><clipPath id="sell-photo"><rect x="16" y="16" width="176" height="176" rx="16" /></clipPath></defs>
    <g data-n="photo"><image href="/garment.jpg" x="16" y="16" width="176" height="176" clipPath="url(#sell-photo)" preserveAspectRatio="xMidYMid slice" /></g>
    <rect data-n="scan" data-k="scan" x="16" y="16" width="176" height="2" />
    {facts.map((fact, i) => {
      const [x, y, w, h] = fact.region, rowY = 16 + i * 44;
      return <g key={fact.label}>
        <rect data-n="region" data-k="region" x={x} y={y} width={w} height={h} rx={4} />
        <path data-n="leader" data-k="edge" pathLength={1} d={`M208 ${rowY + 18} L${x + w} ${y + h / 2}`} />
        <g data-n="fact"><rect data-k="box" x="208" y={rowY} width="176" height="36" rx="10" /><text data-k="sub" x="220" y={rowY + 15}>{fact.label}</text><text x="220" y={rowY + 29}>{fact.value}</text></g>
      </g>;
    })}
    <g data-n="fact"><rect data-k="box-empty" x="208" y="148" width="176" height="36" rx="10" /><text data-k="sub" x="220" y="163">Brand</text><text data-k="needs" x="220" y="177">Add a label photo</text></g>

    <g data-n="price"><text data-k="sub" x="16" y="226">Similar ones sold for</text><text data-k="big" x="16" y="254">{usd(range.q10)} to {usd(range.q90)}</text><text data-k="sub" x="384" y="254" textAnchor="end">middle {usd(range.q50)}</text></g>
    <rect data-k="track" x="16" y="268" width="368" height="8" rx="4" />
    <rect data-n="band" data-k="band" x={priceX(range.q10)} y="268" width={priceX(range.q90) - priceX(range.q10)} height="8" rx="4" />
    <rect data-n="price" data-k="tick" x={priceX(range.q50) - 1.5} y="263" width="3" height="18" rx="1.5" />

    <text data-n="site" data-k="sub" x="16" y="312">What you keep on a {usd(range.q50)} sale</text>
    {keeps.map((row, i) => {
      const y = 324 + i * 30;
      return <g key={row.site} data-n="site">
        <image href={logo(row.site)} x="16" y={y} width="22" height="22"><title>{siteName[row.site]}</title></image>
        <rect data-n="bar" data-k={i === 0 ? 'band' : 'bar'} x="48" y={y + 6} width={row.keep_cents / range.q50 * 268} height="10" rx="5" />
        <text x="384" y={y + 16} textAnchor="end">{usd(row.keep_cents, 2)}</text>
        {row.site === 'facebook_local' && <text data-k="sub" x="54" y={y + 28}>local pickup, no fee</text>}
      </g>;
    })}
    <g data-n="review"><rect data-k="box-accent" x="16" y="482" width="368" height="30" rx="15" /><path data-k="check" d="m32 497 4 4 8-9" /><text x="54" y="501">Nothing goes live until you have reviewed it</text></g>
  </svg>;
}

/* ---------- buying ---------- */
const found = [ // in the order the answer ends in; `from` is the slot each arrived in
  { site: 'poshmark', detail: 'Fair · 34 × 32', price: 18, ship: 8, from: 3 },
  { site: 'depop', detail: 'Good · 34 × 32', price: 24, ship: 6, from: 2 },
  { site: 'facebook', detail: 'Good · 34 × 30 · pickup', price: 30, ship: 0, from: 4 },
  { site: 'ebay', detail: 'Good · 34 × 32', price: 36, ship: 9, from: 0, out: 'over $40' },
  { site: 'mercari', detail: 'Good · 30 × 32', price: 20, ship: 5, from: 1, out: '30 waist' },
];
const fan = ['ebay', 'mercari', 'depop', 'poshmark', 'facebook'];

function BuyFigure() {
  const best = found[0];
  return <svg className={styles.fig} viewBox="0 0 400 500" role="img" aria-label={`One search, black carpenter pants with a 34 waist under $40, goes to eBay, Mercari, Depop, Poshmark and Facebook Marketplace at once. Each listing shows its total with shipping. One is over budget and one is the wrong size. The cheapest that fits is $${best.price + best.ship} on Poshmark, in fair condition. These listings are examples.`}>
    <g data-n="query"><rect data-k="box" x="40" y="14" width="320" height="40" rx="20" /><text x="200" y="39" textAnchor="middle">black carpenter pants, 34 waist, under $40</text></g>
    {fan.map((site, i) => <path key={site} data-n="fan" data-k="edge" pathLength={1} d={`M200 54 C200 80 ${40 + i * 80} 70 ${40 + i * 80} 96`} />)}
    {fan.map((site, i) => <image key={site} data-n="logo" href={logo(site)} x={26 + i * 80} y="98" width="28" height="28"><title>{siteName[site]}</title></image>)}
    {found.map((row, i) => <g key={row.site} data-n="row" data-from={row.from - i}>
      <g data-n={row.out ? 'dim' : undefined} data-k={row.out ? 'dim' : undefined}>
        <rect data-k="box" x="16" y={150 + i * 52} width="368" height="44" rx="12" />
        <image href={logo(row.site)} x="28" y={161 + i * 52} width="22" height="22"><title>{siteName[row.site]}</title></image>
        <text x="60" y={row.out ? 169 + i * 52 : 177 + i * 52}>{row.detail}</text>
        {row.out && <text data-n="reason" data-k="needs" x="60" y={185 + i * 52}>{row.out}</text>}
        <text data-n="ship" data-k="sub" x="322" y={177 + i * 52} textAnchor="end">${row.price}{row.ship ? ` + $${row.ship} shipping` : ', no shipping'}</text>
        <text data-n="total" data-k="total" x="372" y={178 + i * 52} textAnchor="end">${row.price + row.ship}</text>
      </g>
    </g>)}
    <rect data-n="proof" data-k="ring" x="336" y="160" width="42" height="24" rx="8" />
    <g data-n="answer"><rect data-k="box-accent" x="16" y="422" width="368" height="62" rx="16" /><text x="32" y="448">Cheapest that fits: <tspan data-k="accent">${best.price + best.ship}</tspan> on Poshmark, fair condition.</text><path data-k="check" d="m33 466 3.5 3.5 7-8" /><text data-k="sub" x="50" y="470">The ${best.price + best.ship} was checked against the listing it came from</text></g>
  </svg>;
}

/* ---------- weighing ---------- */
const wx = (dollars: number) => 30 + (dollars - 20) / 80 * 350;
const wy = (age: number) => 296 - Math.min(age, 270) / 270 * 236;
const radius = (w: number) => Math.max(2.5, 15 * Math.sqrt(w / 1.2));

function WeighFigure() {
  return <svg className={styles.fig} viewBox="0 0 400 410" role="img" aria-label={`Twelve example sales and three asking prices plotted by price and age. Asking prices are set aside. Recent, closely matching sales are drawn larger because they count for more. One sale at $95 is set aside as an outlier. The range read from the rest is ${usd(range.q10)} to ${usd(range.q90)}, with ${usd(range.q50)} in the middle.`}>
    <text data-k="sub" x="30" y="18">Each dot is one sale. Its size is how much it counts.</text>
    <text data-k="sub" x="16" y="64" transform="rotate(-90 16 64)" textAnchor="end">older</text>
    <text data-k="sub" x="16" y="296" transform="rotate(-90 16 296)">newer</text>
    <path data-k="axis" d="M30 316 H380" />
    {[20, 40, 60, 80, 100].map(d => <g key={d}><path data-k="axis" d={`M${wx(d)} 316 v5`} /><text data-k="sub" x={wx(d)} y="335" textAnchor="middle">${d}</text></g>)}
    {asks.map(a => <circle key={a.dollars} data-n="ask" data-k="ask" cx={wx(a.dollars)} cy={wy(a.age_days)} r="7" />)}
    {dots.map(d => {
      const r = radius(d.w);
      return <circle key={d.id} data-n="dot" data-k={d.out ? 'dot-out' : 'dot'} data-out={d.out || undefined} data-eq={7 / r} data-age={radius(d.w_age) / r} cx={wx(d.dollars)} cy={wy(d.age_days)} r={r} />;
    })}
    {dots.filter(d => d.out).map(d => <g key={d.id} data-n="cross"><path data-k="cross" d={`M${wx(d.dollars) - 6} ${wy(d.age_days) - 6} l12 12 m0 -12 l-12 12`} /><text data-k="needs" x={wx(d.dollars)} y={wy(d.age_days) - 14} textAnchor="middle">far from the rest</text></g>)}
    <text data-n="asklabel" data-k="sub" x={wx(64)} y={wy(20) - 14} textAnchor="middle">asking prices</text>
    <rect data-n="band" data-k="band" x={wx(range.q10 / 100)} y="348" width={wx(range.q90 / 100) - wx(range.q10 / 100)} height="10" rx="5" />
    <rect data-n="range" data-k="tick" x={wx(range.q50 / 100) - 1.5} y="343" width="3" height="20" rx="1.5" />
    <text data-n="range" data-k="big" x={wx(range.q50 / 100)} y="392" textAnchor="middle">{usd(range.q10)} to {usd(range.q90)}</text>
  </svg>;
}

function Rules({ title, rows, max, note }: { title: string; rows: (string | number)[][]; max: number; note: string }) {
  return <div className={styles.rule}><h3>{title}</h3>
    <dl>{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd><span className={styles.ruleTrack}><span data-n="rule" style={{ width: `${Number(value) / max * 100}%` }} /></span><span className={styles.ruleValue}>{Number(value) === 0 ? 'none' : `× ${Number(value).toFixed(2).replace(/0$/, '')}`}</span></dd></div>)}</dl>
    <p>{note}</p></div>;
}

/* ---------- Databricks ---------- */
function LakeFigure() {
  const child = [['comp_daily', 'daily medians'], ['product', 'what exists'], ['comp_for_model', 'may_model = true']];
  const jobs = ['backtest', 'param walk', 'recompute', 'parity'];
  const reads = ['why(id)', 'guard', 'dashboard', 'Genie'];
  return <svg className={styles.fig} viewBox="0 0 400 690" role="img" aria-label="The Databricks architecture. Six public sold datasets land in a Unity Catalog volume. The Lakeflow pipeline secondhand-market keeps each row as it arrived in sold_raw, checks price, source and rights, and writes typed rows to comp. Three views read comp; comp_for_model holds only rows a model may use. Jobs fit and test against that view and log to MLflow. The measures schema holds the why function, the guard, the dashboard and Genie. New weights are exported to a volume the server reads, and app logs go back into the landing volume.">
    <rect data-n="frame" data-k="frame" x="6" y="30" width="388" height="560" rx="16" />
    <text data-n="frame" data-k="sub" x="14" y="21">Unity Catalog · catalog secondhand</text>
    <text data-n="policy" data-k="accent" x="394" y="21" textAnchor="end">row filters · column masks</text>

    <Edge n="e1" d="M200 90 V132" /><Edge n="e2" d="M200 172 V224" /><Edge n="e2x" d="M270 198 H330" />
    <Edge n="e3" d="M200 264 L92 284" /><Edge n="e3" d="M200 264 V284" /><Edge n="e3" d="M200 264 L320 284" />
    <Edge n="e4" d="M320 322 V372" /><Edge n="e5" d="M200 406 V458" /><Edge n="e6" d="M200 492 V524" /><Edge n="e6" d="M200 568 V616" />
    <Edge n="loop" d="M110 641 H30 Q18 641 18 629 V79 Q18 67 30 67 H90" />
    <circle data-n="packet" data-k="packet" data-path="M200 90 V264 L320 284 V372 L200 406 V616" r="4" />
    <circle data-n="packet" data-k="packet" data-path="M200 90 V264 L320 284 V372 L200 406 V616" data-delay="1.6" r="4" />
    <circle data-n="packet" data-k="packet-bad" data-path="M200 90 V198 H330" data-delay=".8" r="4" />
    <circle data-n="packet" data-k="packet" data-path="M110 641 H30 Q18 641 18 629 V79 Q18 67 30 67 H90" data-delay="2.4" r="3" />

    <Box n="landing" x={90} y={44} w={220} h={46} title="raw.landing" sub="1.69M sold rows · 6 sources" />
    <g data-n="pipeline"><rect data-k="group" x="30" y="106" width="352" height="226" rx="12" /><text data-k="sub" x="40" y="123">Lakeflow pipeline · secondhand-market</text></g>
    <Box n="sold_raw" x={110} y={132} w={180} title="sold_raw" sub="every cell kept as text" />
    <g data-n="gate"><rect data-k="box-accent" x="130" y="186" width="140" height="24" rx="12" /><text data-k="sub-ink" x="200" y="202" textAnchor="middle">price · source · rights</text><text data-k="bad" x="336" y="202">dropped</text></g>
    <Box n="comp" x={110} y={224} w={180} title="comp" sub="typed, with source and rights" />
    {child.map(([title, sub], i) => <Box key={title} n="child" x={36 + i * 114} y={284} w={112} h={38} title={title} sub={sub} accent={i === 2} />)}
    <g data-n="jobs"><rect data-k="group" x="30" y="346" width="352" height="74" rx="12" /><text data-k="sub" x="40" y="363">Jobs · runs logged to MLflow</text>{jobs.map((title, i) => <Box key={title} n="chip" x={36 + i * 86} y={372} w={80} h={34} title={title} />)}</g>
    <g data-n="reads"><rect data-k="group" x="30" y="432" width="352" height="74" rx="12" /><text data-k="sub" x="40" y="449">measures · what a person reads</text>{reads.map((title, i) => <Box key={title} n="chip" x={36 + i * 86} y={458} w={80} h={34} title={title} />)}</g>
    <Box n="export" x={110} y={524} w={180} h={44} title="raw.export" sub="params/latest.json" />
    <Box n="server" x={110} y={616} w={180} h={50} title="secondhand server" sub="reads new weights on a timer" accent />
    <text data-n="server" data-k="sub" x="30" y="608">logs go back in</text>
  </svg>;
}

export default function EnginePage() {
  return <main id="main" className={styles.page} data-engine>
    <Motion />
    <header className={`${styles.hero} marketing-atmosphere`} data-tone="process">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Engine</p>
        <h1 className="marketing-page-title">Digging through secondhand stores, coming back with calculated answers</h1>
        <p className={styles.lead}>Market intelligence meets structured inference. Every listing we read becomes a typed record that keeps its source, and every answer is arithmetic over records you can open.</p><p className={styles.leadNote}>The example item below is made up. The weights, the cuts and the fees are computed by the same functions the app calls.</p>
        <nav className={styles.jump} aria-label="On this page"><a className="marketing-pill" href="#selling">Selling <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#buying">Buying <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#weighing">How sales are weighed <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#markets">Where to list <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#databricks">Databricks <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#answers">What the data answers <Icon name="arrow-down-01" size={16} /></a></nav>
      </div>
    </header>

    <section id="selling" className={styles.act} data-act="sell" aria-labelledby="selling-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>Selling</p><h2 id="selling-title">One photo in.<br />A listing you can check out</h2><p>Capture, pricing from sold listings and listing prep run today. You finish posting on the marketplace yourself; automatic posting is not connected to live accounts yet.</p></div>
        <div className={styles.scroller}>
          <ol className={styles.steps}>
            <Step title="Start with a photo">The camera asks for the views this kind of item needs. One clear photo is enough to begin.</Step>
            <Step title="Every fact points at its source">Each detail is tied to the part of the photo it was read from, so you can check it. What the photo does not show stays empty. Here the brand waits for a photo of the label instead of being guessed.</Step>
            <Step title="Sold prices set the range">The range comes from similar items that sold. It is a range because used prices for the same item differ from sale to sale.</Step>
            <Step title="Same sale, different take-home">Each marketplace takes a different cut. The fee table is fixed and dated, so the amount you keep is arithmetic.</Step>
            <Step title="You approve what goes live">Review the photos, the price and the description, then post. A wrong size or condition changes the price, so the check comes before a buyer sees anything.</Step>
          </ol>
          <div className={styles.stage}><SellFigure /><p className={styles.caption}>Example item. Fee model of November 14, 2026: the buyer pays $6 shipping, which covers the label; tax and paid promotion are excluded.</p></div>
        </div>
        <div className={styles.links}><SourceLink path="app/src/engines/valuation/keep.ts">Read the fee table</SourceLink><Link className={styles.link} href="/how-it-works">See the selling steps <Icon name="arrow-right-01" size={16} /></Link></div>
      </div>
    </section>

    <section id="buying" className={styles.act} data-act="buy" data-flip aria-labelledby="buying-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>Buying</p><h2 id="buying-title">One search.<br />Five marketplaces</h2><p>Search across the marketplaces in one query works today, and so does the chat that answers from what it found. You buy on the marketplace. secondhand never holds the payment.</p></div>
        <div className={styles.scroller}>
          <ol className={styles.steps}>
            <Step title="Ask once">The same words go to every marketplace at the same time, each in the form that site understands.</Step>
            <Step title="Compare the cost to your door">A $18 listing with $8 shipping costs more than it looks. Every result shows its price, its shipping and the total.</Step>
            <Step title="Size and budget come first">A low price in the wrong size is not a match. Listings that miss your size or go over budget once shipped drop to the bottom, with the reason beside them.</Step>
            <Step title="Answers quote the listings">The chat answers only from listings it found. Before you see a figure, it is checked against the listing it came from.</Step>
          </ol>
          <div className={styles.stage}><BuyFigure /><p className={styles.caption}>Example listings, not live results.</p></div>
        </div>
        <div className={styles.links}><Link className={styles.link} href="/buy">Try a search <Icon name="arrow-right-01" size={16} /></Link><SourceLink path="docs/how-it-works/search-and-shopping.md">Read the search design</SourceLink></div>
      </div>
    </section>

    <section id="weighing" className={styles.act} data-act="weigh" aria-labelledby="weighing-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>The pricing engine</p><h2 id="weighing-title">Not every sale<br />counts the same</h2><p>The engine is plain arithmetic you can read. Each sale gets a weight, and the range is read from the weights.</p></div>
        <div className={styles.scroller}>
          <ol className={styles.steps}>
            <Step title="Start with everything found">Twelve sales and three asking prices for similar pants. Left to right is price. Bottom to top is how long ago.</Step>
            <Step title="Asking prices are set aside">An asking price is what a seller hopes for. Only completed sales, accepted offers and your own orders can enter the calculation.</Step>
            <Step title="Recent sales count more">A sale loses half its weight every {halfLife} days. Anything older than a year is left out.</Step>
            <Step title="Closer matches count more">The same item in the same variant counts in full, the same product counts half, and the same family a quarter.</Step>
            <Step title="One odd sale cannot move it">A sale far from the rest is set aside. The cut is measured from the middle of the other sales, so one $95 pair does not drag the range up.</Step>
            <Step title="The range is read from the weights">The low, middle and high marks sit where 10%, 50% and 90% of the weight falls. When too few sales carry weight, the app widens the range or shows no price.</Step>
          </ol>
          <div className={styles.stage}><WeighFigure /><p className={styles.caption}>Example sales, sized by the weighting function the app runs.</p></div>
        </div>
        <div className={styles.rules} data-rules>
          <Rules title="What kind of record" rows={rules.type} max={1.35} note="A sale you completed through secondhand is the best evidence there is." />
          <Rules title="How close the match" rows={rules.match} max={1.35} note="Each step away from the exact item halves the weight." />
          <Rules title="How long ago" rows={rules.age} max={1.35} note={`Half the weight every ${halfLife} days, 30 in fast-moving categories.`} />
          <Rules title="Condition moves the price" rows={rules.condition} max={1.35} note="A sale in another condition is adjusted to yours before it is compared." />
        </div>
        <p className={styles.note}>These are starting values. A weight is replaced only when a test on past sales shows an improvement larger than the test’s own variation.</p>
        <div className={styles.links}><SourceLink path="app/src/engines/valuation/comps.ts">Read the weighting code</SourceLink><SourceLink path="app/src/engines/valuation/params.ts">See every starting value</SourceLink></div>
      </div>
    </section>

    <section id="markets" className={styles.act} aria-labelledby="markets-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>Where to list</p><h2 id="markets-title">Every marketplace gets<br />its own score for this item</h2><p>A model can already shape an answer around one person. Here the same idea shapes one listing around each marketplace: its fee, its buyers and how fast this kind of item moves there.</p></div>
        <div className={styles.markets} data-rules role="table" aria-label="Score for each marketplace on the example item">
          <div className={styles.marketHead} role="row"><span role="columnheader">Marketplace</span><span role="columnheader">Its fee</span><span role="columnheader">You keep</span><span role="columnheader">Chance in 30 days</span><span role="columnheader">Score</span><span role="columnheader">Sold somewhere by day 30</span></div>
          {markets.map((m, i) => <div key={m.site} className={styles.market} role="row">
            <span role="cell" className={styles.marketSite}><span className={styles.rank}>{i + 1}</span><img src={logo(m.site)} alt={siteName[m.site]} width="28" height="28" />{m.site === 'facebook_local' && <small>local pickup</small>}</span>
            <span role="cell" data-label="Its fee">{m.fee}</span>
            <span role="cell" data-label="You keep">{usd(m.keep_cents, 2)}</span>
            <span role="cell" data-label="Chance in 30 days">{Math.round(m.chance * 100)}%</span>
            <span role="cell" data-label="Score" className={styles.score}>{usd(m.score_cents, 2)}</span>
            <span role="cell" data-label="Sold somewhere by day 30" className={styles.reach}><span className={styles.ruleTrack}><span data-n="rule" style={{ width: `${m.reach * 100}%` }} /></span>{Math.round(m.reach * 100)}%</span>
          </div>)}
        </div>
        <div className={styles.closeGrid}>
          <p>The score is what you keep on that marketplace times the chance it sells there. A marketplace with a 20% fee can still win where the buyers for this item are.</p>
          <p>The order is the order to list in. Each added marketplace has to earn more than the {Math.round(doubleSale * 100)}% risk of two buyers paying at once. {skipped ? `${skipped} did not on this item.` : 'On this item, all five do.'}</p>
          <p>The fees, what you keep and the choice are computed. The chances shown are examples: the curve for each marketplace and kind of item needs live sales, and stays hidden under 30.</p>
        </div>
        <div className={styles.links}><SourceLink path="app/src/engines/valuation/path.ts">Read how marketplaces are chosen</SourceLink><SourceLink path="spec/engines/valuation.md">Read the market score design</SourceLink></div>
      </div>
    </section>

    <section id="databricks" className={styles.act} data-act="lake" data-flip data-tall aria-labelledby="databricks-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>Databricks</p><h2 id="databricks-title">Where the sales live,<br />and how they get checked</h2><p>Read from the workspace on November 15, 2026: the pipeline, 16 jobs, the hourly alert, the dashboard and Genie are there. The nightly refit is paused on purpose.</p></div>
        <div className={styles.scroller}>
          <ol className={styles.steps}>
            <Step title="Files land in a governed volume">1,688,603 sold rows from six public datasets arrive as CSV. Each dataset comes with a manifest that records its licence and whether a model may use it. Two of the six are cleared for modelling.</Step>
            <Step title="Nothing is changed on the way in">sold_raw keeps every cell as text, with the file it came from and when it arrived. Any later row can be traced back to its file.</Step>
            <Step title="Bad rows stop here">A price of zero or less is dropped. A row with no source or no permission flag stops the update, so a gap gets fixed instead of loaded.</Step>
            <Step title="Models get their own view">comp holds every typed row. Fits may read only comp_for_model, the rows a source has cleared for modelling. Display and training are separate permissions.</Step>
            <Step title="Jobs test before anything changes">Backtests replay past sales. The parity job runs one calculation in TypeScript and in Python and compares them. The recompute job rebuilt 42,405 shown numbers; 6 did not match exactly, and those six are listed.</Step>
            <Step title="Every shown price can be opened">why(id) returns the exact sales behind a price and re-hashes them against the stored fingerprint. The guard checks 18 rules every hour and had found no violations at the last check. A rate over fewer than 30 prices is left blank.</Step>
            <Step title="Weights go back to the app">Accepted weights are exported to a volume the server reads on a timer. App logs and benchmark runs land back in the first volume.</Step>
            <Step title="One set of access rules">Unity Catalog applies a row filter and a column mask by tag: each person’s rows are theirs, and buyer and seller handles are masked. Deleting an account removes its rows and blocks any loader from writing them again.</Step>
          </ol>
          <div className={styles.stage}><LakeFigure /></div>
        </div>
        <div className={styles.links}><SourceLink path="databricks/WORKS.md">Read the workspace check</SourceLink><SourceLink path="databricks/pipelines/market/comp.sql">Inspect the pipeline</SourceLink><Link className={styles.link} href="/data-use">How your data is used <Icon name="arrow-right-01" size={16} /></Link></div>
      </div>
    </section>

    <section id="answers" className={styles.act} aria-labelledby="answers-title">
      <div className={styles.wrap}>
        <div className={styles.actHead}><p className={styles.eyebrow}>What the data answers</p><h2 id="answers-title">Ask the market a question.<br />Get the query with the answer</h2><p>Genie reads the same tables and the same metric definitions as the dashboard. These are two of its recorded answers, word for word, from November 15, 2026.</p></div>
        <div className={styles.answers} data-answers>
          <figure className={styles.qa}><figcaption>What is the Adidas Yeezy Boost 350 V2 Zebra worth, and which sales does that rest on?</figcaption><p>“The Adidas Yeezy Boost 350 V2 Zebra was valued at <strong>$337.97</strong> by the nightly market model (not the app engine), based on StockX sales data from February 2019. This price is rebuilt exactly from the <strong>5 sales it cites</strong>, with sale prices ranging from $306.50 to $349.00. All cited sales are from the dataset:stockx_2019, with the most recent basis sale on 2019-02-11.”</p><span>An answer names its model, its dataset and its sales</span></figure>
          <figure className={styles.qa}><figcaption>What is the median sold price of a Yeezy on Depop?</figcaption><p>“There were <strong>0 sales</strong> of Yeezy on Depop in the dataset, so the median sold price cannot be calculated. To resolve this, try a wider date range or include the parent kind.”</p><span>With too few sales, it declines instead of guessing</span></figure>
        </div>
        <SourceLink path="databricks/genie-answers.md">Read all eight questions, answers and SQL</SourceLink>
        <h3 className={styles.nextTitle}>What the same records could answer next</h3>
        <dl className={styles.next}>
          <div><dt>A score for each market</dt><dd>How accurate our prices are for one kind of item on one marketplace, scored on each new sale before that sale can influence a price.</dd><dd>Designed</dd></div>
          <div><dt>The chance it sells by a date</dt><dd>“About 6 in 10 like this sell within a month at $40”, with unsold listings kept in the count so everything does not look faster than it is.</dd><dd>Designed</dd></div>
          <div><dt>A price index per category</dt><dd>Asking and sold prices tracked apart over time, each point showing how many sales it rests on.</dd><dd>Designed</dd></div>
          <div><dt>The search as a tool for other agents</dt><dd>An MCP server so another assistant can run the same marketplace search and get the same cited rows.</dd><dd>In progress</dd></div>
        </dl>
        <div className={styles.links}><SourceLink path="spec/engines/valuation.md">Read the engine spec</SourceLink></div>
      </div>
    </section>

    <section className={`${styles.close} marketing-atmosphere`} data-tone="process" aria-labelledby="close-title"><div className={styles.wrap}>
      <h2 id="close-title">What this page does not show</h2>
      <div className={styles.closeGrid}>
        <p>A full sale on a live account. Posting, sale detection and taking the other listings down have each been tested alone, not yet together.</p>
        <p>Accuracy on used clothing. The published backtest uses historical sneaker sales and a research model, not the engine above.</p>
        <p>Final weights. Every number in the weighing section is a starting value until real sales tune it.</p>
      </div>
      <div className={styles.links}><Link className={styles.link} href="/whats-next">What we test next <Icon name="arrow-right-01" size={16} /></Link><Link className={styles.link} href="/data-use">The backtest and its limits <Icon name="arrow-right-01" size={16} /></Link></div>
    </div></section>
  </main>;
}
