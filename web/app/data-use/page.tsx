import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Data Use · secondhand',
  description: 'Follow the records behind a price, inspect our Databricks architecture, and see how we tested estimates on historical sales.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const platform = [
  { name: 'Lakeflow', title: 'Check records as they arrive.', text: 'Six public sold datasets pass through a bronze-to-silver pipeline. Expectations stop or drop bad rows, and the source’s usage rights travel with each record.', path: 'databricks/pipelines/market/comp.sql', link: 'Inspect the pipeline' },
  { name: 'Unity Catalog', title: 'Keep access and rights with the data.', text: 'Row filters separate personal records. Column masks hide buyer and seller handles. The model reads a dedicated view containing only records marked for model use.', path: 'databricks/pipelines/market/comp_for_model.sql', link: 'Inspect the model view' },
  { name: 'Delta', title: 'Keep the history of a decision.', text: 'Change data feed records each move in a pricing weight. Loaders merge new records, skip erased people, and use a separate deletion workflow to remove retained data.', path: 'databricks/sql/12_erasure.sql', link: 'Inspect the deletion workflow' },
  { name: 'SQL basis check', title: 'Connect one number to its source rows.', text: 'Our SQL function opens a recorded price to its exact cited sales and rebuilds the evidence hash. A matching hash checks that the recorded basis agrees with those rows.', path: 'databricks/sql/07_why.sql', link: 'Inspect the SQL' },
  { name: 'MLflow', title: 'Test a change before replacing a model.', text: 'Backtests and monthly weight experiments record their parameters, results, and underlying Delta table version. A challenger has to beat the current weight by more than the measured noise.', path: 'databricks/DEMO.md#4-a-weight-that-moved-only-on-evidence', link: 'Inspect the experiment' },
];

function Arrow() { return <span aria-hidden="true">↗</span>; }
function SourceLink({ path, children }: { path: string; children: React.ReactNode }) {
  return <a className={styles.link} href={`${repo}${path}`}>{children} <Arrow /></a>;
}

function DataIcon({ kind }: { kind: 'records' | 'check' | 'database' | 'price' }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'records' && <><path d="m4 11 12-7 12 7-12 7-12-7Z" /><path d="m4 16 12 7 12-7M4 21l12 7 12-7" /></>}
    {kind === 'check' && <><path d="m16 3 11 4v8c0 7-11 14-11 14S5 22 5 15V7l11-4Z" /><path d="m11 15 4 4 7-8" /></>}
    {kind === 'database' && <><ellipse cx="16" cy="7" rx="11" ry="4" /><path d="M5 7v17c0 5 22 5 22 0V7M5 15c0 5 22 5 22 0" /></>}
    {kind === 'price' && <><path d="M4 4h14l11 11-14 14L4 18V4Z" /><circle cx="10" cy="10" r="1.5" /></>}
  </svg>;
}

export default function DataUsePage() {
  return <main id="main" className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Data Use</p>
        <h1>The data architecture driving intelligence</h1>
        <p className={styles.lead}>Follow a price back to the sales behind it.</p>
        <figure className={styles.architecture} aria-label="Source records pass through quality and rights checks. Usable evidence supports an inspectable price. Other records are excluded or kept for display only.">
          <div className={styles.flow}>
            <div className={styles.node}><DataIcon kind="records" /><h2>Source records</h2><p>Sold prices, asking prices, dates and item details.</p></div>
            <span className={styles.connector} aria-hidden="true">→</span>
            <div className={styles.node}><DataIcon kind="check" /><h2>Quality and rights checks</h2><p>Is it usable? What does the source allow?</p></div>
            <span className={styles.connector} aria-hidden="true">→</span>
            <div className={styles.node}><DataIcon kind="database" /><h2>Usable evidence</h2><p>Comparable records with their source and date.</p></div>
            <span className={styles.connector} aria-hidden="true">→</span>
            <div className={styles.node}><DataIcon kind="price" /><h2>A price you can inspect</h2><p>The estimate and the sales it rests on.</p></div>
          </div>
          <figcaption className={styles.branch}><span aria-hidden="true">↳</span> Excluded or display only <span className={styles.branchReason}>Rights and quality determine where a row can go.</span></figcaption>
        </figure>
        <nav className={styles.jumpLinks} aria-label="On this page"><a className={styles.primary} href="#pipeline">Follow the pipeline <span aria-hidden="true">↓</span></a><a className={styles.secondary} href="#pricing-result">See the pricing result <span aria-hidden="true">↓</span></a><a className={styles.quiet} href="#your-data">Your account data <span aria-hidden="true">↓</span></a></nav>
      </div>
    </header>

    <section id="pipeline" className={`${styles.wrap} ${styles.section}`} aria-labelledby="pipeline-title">
      <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>The data pipeline</p><h2 id="pipeline-title">Messy records.<br />Clear reasons.</h2></div><p>Two prices can look alike and mean different things. We keep the source, date and usage rights so each record can be used for the right job.</p></div>
      <div className={styles.recordTable} role="table" aria-label="Illustrative data decisions">
        <div className={styles.tableHead} role="row"><span role="columnheader">Record</span><span role="columnheader">What it tells us</span><span role="columnheader">In this example</span></div>
        <div className={`${styles.record} ${styles.used}`} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">✓</span>Sold price</span><span role="cell">A comparable item sold, with permitted use.</span><span role="cell">Used as evidence</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">○</span>Asking price</span><span role="cell">What a seller wants. No completed sale.</span><span role="cell">Market context</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">×</span>Duplicate</span><span role="cell">The same sale has already been recorded.</span><span role="cell">Excluded</span></div>
      </div>
      <p className={styles.caption}>Illustrative records, not a live estimate. Source permissions determine which records may be stored, shown or used in a model.</p>
      <SourceLink path="databricks/pipelines/market/comp_for_model.sql">See which rows can enter a model</SourceLink>
    </section>

    <section id="databricks" className={`${styles.wrap} ${styles.section} ${styles.platformSection}`} aria-labelledby="databricks-title">
      <p className={styles.eyebrow}>Databricks</p><h2 id="databricks-title">Built on Databricks.<br />Inspectable down to the row.</h2>
      <div className={styles.platformGrid}>
        <ol className={styles.platformList}>{platform.map((item, index) => <li key={item.name} className={index === 3 ? styles.basis : ''}>
          <span className={styles.number}>{index + 1}</span><div><p className={styles.toolName}>{item.name}</p><h3>{item.title}</h3><p className={styles.toolText}>{item.text}</p><SourceLink path={item.path}>{item.link}</SourceLink></div>
        </li>)}</ol>
        <aside className={styles.engineeringNote}><p className={styles.eyebrow}>Why we built the extra step</p><p className={styles.statement}>Table lineage tells us where data came from. Our SQL check connects an individual price to its exact source rows.</p><p>That makes a number inspectable. It still needs separate evidence that its sources are current and its estimate is accurate.</p><details><summary>What happens when a check cannot pass?</summary><p>Missing rows and mismatched hashes return a failure reason. Weighted citations return “weights not stored” when the saved basis cannot support a reconstruction. We keep that uncertainty visible.</p><p>Row filters also prevented a table constraint. We added checks before publication, a guard job and a SQL alert.</p><SourceLink path="databricks/sql/07_why.sql">Read the checks and failure reasons</SourceLink></details><SourceLink path="databricks/DEMO.md">Walk through the Databricks build</SourceLink></aside>
      </div>
    </section>

    <section id="pricing-result" className={styles.resultSection} aria-labelledby="result-title"><div className={styles.wrap}>
      <p className={styles.eyebrow}>Testing on past sales</p><h2 id="result-title">84% fewer big pricing misses</h2><p className={styles.resultLead}>The research model was far less likely to price an item more than 20% away from what it actually sold for.</p>
      <figure className={styles.chart} aria-label="Big pricing misses in paired historical StockX sales: 90-day median 9.8 percent, research model 1.5 percent. Lower is better.">
        <figcaption>Share of estimates more than 20% from the sale price <span>Lower is better</span></figcaption>
        <div className={styles.chartRow}><span>90-day median</span><div className={styles.track}><div className={styles.baselineBar} /></div><span className={styles.value}>9.8%</span></div>
        <div className={styles.chartRow}><span>Research model</span><div className={styles.track}><div className={styles.modelBar} /></div><span className={styles.value}>1.5%</span></div>
        <div className={styles.axis} aria-hidden="true"><span>0%</span><span>2%</span><span>4%</span><span>6%</span><span>8%</span><span>10%</span></div>
      </figure>
      <div className={styles.resultFoot}><p>Historical sneaker research. This model is separate from the engine served in the app.</p><a className={styles.link} href="#method">Method and limits <span aria-hidden="true">↓</span></a></div>
      <details id="method" className={styles.method} open><summary>What we measured</summary><div className={styles.methodGrid}><p>39,707 paired sales out of 41,988 test sales. New Off-White x Nike and Yeezy 350 sneakers on StockX, November 2018 to February 2019. Estimates used earlier sales.</p><p>The comparison uses the same sales for both methods. A big miss is more than 20% from the eventual sale price. The relative reduction is calculated from the unrounded rates, then rounded to 84%.</p><p>This measures historical pricing error. It does not establish savings, faster sales or accuracy across today’s clothing market. The app’s served engine has its own published evaluation.</p></div><div className={styles.sourceLinks}><SourceLink path="scripts/bench/out/backtest-stockx.json">Full research results</SourceLink><SourceLink path="spec/engines/valuation.md#9-proof">Served engine evaluation</SourceLink></div></details>
    </div></section>

    <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="limits-title"><p className={styles.eyebrow}>Where the evidence runs thin</p><h2 id="limits-title">A price needs context.</h2><div className={styles.limitGrid}><div><h3>An asking price is a different signal.</h3><p>A listing tells us what a seller wants. A completed sale tells us what a buyer paid. Sparse sales, different conditions and old records all affect how much an estimate can tell you.</p></div><div><h3>Small samples need a visible limit.</h3><p>In the Databricks report, rates over fewer than 30 shown prices stay blank. The app has separate rules for its price ranges and fallback evidence. A historical sneaker result cannot stand in for every item in your closet.</p><SourceLink path="databricks/DEMO.md">Inspect the reporting rules</SourceLink></div></div></section>

    <section id="your-data" className={`${styles.wrap} ${styles.section} ${styles.accountSection}`} aria-labelledby="account-title"><p className={styles.eyebrow}>Your account data</p><h2 id="account-title">What each input is for.</h2><p className={styles.accountLead}>The product’s data-use plan connects each input to a purpose and a control. These are the intended rules, with implementation details available in the repository.</p>
      <dl className={styles.accountData}><div><dt>Photos and item details</dt><dd>Identify the item, record its condition and prepare its listing. You review the facts and photos before approving the listing.</dd></div><div><dt>Searches and preferences</dt><dd>Find items that fit what you asked for, including size, budget and condition. The plan keeps personal corrections scoped to your own results unless you opt in to shared training.</dd></div><div><dt>Marketplace connections</dt><dd>Read the listings, messages and orders needed for the actions you authorize. The plan separates connection credentials from model prompts and logs.</dd></div></dl>
      <div className={styles.nextLinks}><SourceLink path="spec/data-use.md">Read the data-use plan</SourceLink><Link className={styles.link} href="/faq">Questions about permissions <span aria-hidden="true">→</span></Link><Link className={styles.link} href="/features">See what this makes possible <span aria-hidden="true">→</span></Link></div>
    </section>
  </main>;
}
