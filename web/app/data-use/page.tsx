import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Data Use · secondhand',
  description: 'Follow the records behind a price, inspect our Databricks architecture, and see how we tested estimates on historical sales.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const marketplaces = [
  { name: 'eBay', text: 'Listings and product details, using the official API where available. Our source rules allow display separately from model training; eBay content is not cleared for training.' },
  { name: 'Poshmark', text: 'Public listing details and whether an item is marked sold. The sold badge does not tell us the final price a buyer paid.' },
  { name: 'Depop', text: 'Public listings help find items. Reading orders and messages requires a separate signed-in connection. We do not have confirmed partner API access.' },
  { name: 'Mercari', text: 'Public listings and whether an item is marked sold. These live records stay separate from Mercari’s historical competition dataset.' },
  { name: 'Facebook Marketplace', text: 'Local listings collected through Apify. They show asking prices; pickup details and availability still need checking.' },
];
const platform = [
  { name: 'Lakeflow', title: 'Check records as they arrive', text: 'Lakeflow turns CSV fields into typed records and drops invalid prices. If a row is missing its source or permission flag, the update stops. Every accepted row keeps both, so later steps can check how it may be used.', path: 'databricks/pipelines/market/comp.sql', link: 'Inspect the pipeline' },
  { name: 'Unity Catalog', title: 'Control who can read each record', text: 'Row filters limit which personal records an account can read. Column masks hide buyer and seller handles from readers outside the support group. Tags apply these policies across tables, rather than relying on each query to filter correctly.', path: 'databricks/sql/02_governance.sql', link: 'Inspect the access policies' },
  { name: 'Delta', title: 'Keep the history of a pricing change', text: 'Delta’s change data feed records each pricing-parameter change. The import jobs merge updates but reject data from deleted accounts, so an import cannot bring it back. A separate deletion job removes current records and schedules removal of retained files.', path: 'databricks/DEMO.md#6-deletion', link: 'Inspect the deletion workflow' },
  { name: 'Databricks SQL', title: 'Check the records behind an estimate', text: 'Our SQL function returns the cited rows for a saved estimate. It checks their fingerprint against the one stored with the estimate, so we can detect missing or changed evidence.', path: 'databricks/sql/07_why.sql', link: 'Inspect the SQL function' },
  { name: 'MLflow', title: 'Keep model comparisons reproducible', text: 'Each historical test saves its settings, results and Delta table version so we can repeat the comparison. In the monthly experiment, a new pricing weight replaces the current one only if its improvement is larger than the variation measured in the test.', path: 'databricks/tasks/param_walk.py', link: 'Inspect the experiment' },
  { name: 'AI/BI and Genie', title: 'Ask questions of the same results', text: 'The dashboard and Genie use the same metric definitions, so their answers can be compared. Saved questions include the SQL that produced the answer. A report needs at least 30 displayed prices before it shows a rate.', path: 'databricks/genie-answers.md', link: 'Read the questions, answers and SQL' },
];

function Arrow() { return <Icon name="arrow-right-01" size={16} />; }
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
    <header className={`${styles.hero} marketing-atmosphere`} data-tone="evidence">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Data Use</p>
        <h1 className="marketing-page-title">The data architecture driving intelligence</h1>
        <p className={styles.lead}>Follow a price back to the sales behind it.</p>
        <figure className={styles.architecture} aria-label="Records are checked for valid values and permitted use. Eligible sales support a price estimate with links to its evidence. Other records are rejected or displayed without entering a model.">
          <div className={styles.flow}>
            <div className={styles.node}><DataIcon kind="records" /><h2>Source records</h2><p>Sold prices, asking prices, dates and item details.</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="check" /><h2>Quality and usage checks</h2><p>Is the record valid? Is this use permitted?</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="database" /><h2>Comparable sales</h2><p>Similar items, with a source and date for each sale.</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="price" /><h2>A price you can inspect</h2><p>The estimate and the sales it rests on.</p></div>
          </div>
          <figcaption className={styles.branch}><span aria-hidden="true">↳</span> Excluded or display only <span className={styles.branchReason}>Invalid records are rejected. Permission to use a record in a model is a separate check.</span></figcaption>
        </figure>
        <nav className={styles.jumpLinks} aria-label="On this page"><a className={styles.quiet} href="#sources">The five marketplaces <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill" href="#pipeline">Follow the pipeline <Icon name="arrow-down-01" size={16} /></a><a className="marketing-pill marketing-pill-secondary" href="#pricing-result">See the pricing result <Icon name="arrow-down-01" size={16} /></a><a className={styles.quiet} href="#your-data">Your account data <Icon name="arrow-down-01" size={16} /></a></nav>
      </div>
    </header>

    <section id="sources" className={`${styles.wrap} ${styles.section}`} aria-labelledby="sources-title">
      <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>Where the records come from</p><h2 id="sources-title">Five marketplaces.<br />Different kinds of evidence</h2></div><p>The integration design draws on these five marketplaces. Reading a public listing, accessing an account and training a model each require separate permissions.</p></div>
      <dl className={styles.accountData}>{marketplaces.map(source => <div key={source.name}><dt>{source.name}</dt><dd>{source.text}</dd></div>)}</dl>
      <div className={styles.sourceLinks}><SourceLink path="spec/engines/protocol-and-adapters.md">Read the marketplace capabilities</SourceLink><SourceLink path="databricks/sql/11_sources.sql">Inspect the source-use registry</SourceLink></div>
      <details className={styles.method}><summary>How are the historical datasets different?</summary><div className={styles.methodGrid}><p>The Databricks build contains six historical research datasets: StockX 2019, Mercari’s Kaggle competition, Grailed 2021, eBay sold comps, ShopGoodwill auctions and a separate Mercari collection.</p><p>Only some are used in research models. For each source, the registry records whether we may store, display, model or share its records. A dataset publisher’s license does not override the marketplace’s restrictions.</p><p>The 84% result below uses historical StockX sneakers only. Permission for demo research does not clear a source for a model used by customers. No source in the current registry has that clearance.</p></div><SourceLink path="research/price/ben/sold-datasets.md">Read dataset origins, attribution and limits</SourceLink></details>
    </section>

    <section id="pipeline" className={`${styles.wrap} ${styles.section}`} aria-labelledby="pipeline-title">
      <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>The data pipeline</p><h2 id="pipeline-title">A sold price is different<br />from an asking price</h2></div><p>Each record keeps its price type, source, date and permissions. Models read a separate SQL view that includes only records marked for model use.</p></div>
      <div className={styles.recordTable} role="table" aria-label="How records are used">
        <div className={styles.tableHead} role="row"><span role="columnheader">Record</span><span role="columnheader">What it tells us</span><span role="columnheader">Pricing use</span></div>
        <div className={`${styles.record} ${styles.used}`} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">✓</span>Sold price</span><span role="cell">What a buyer paid for a comparable item, where use is permitted.</span><span role="cell">Eligible as evidence</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">○</span>Asking price</span><span role="cell">What a seller wants. No completed sale.</span><span role="cell">Market context</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">×</span>Invalid price</span><span role="cell">The price is zero or below.</span><span role="cell">Excluded</span></div>
      </div>
      <p className={styles.caption}>A valid price still needs permission before it can enter a model.</p>
      <SourceLink path="databricks/pipelines/market/comp_for_model.sql">See which rows can enter a model</SourceLink>
    </section>

    <section id="databricks" className={`${styles.wrap} ${styles.section} ${styles.platformSection}`} aria-labelledby="databricks-title">
      <p className={styles.eyebrow}>Databricks</p><h2 id="databricks-title">Built on Databricks.<br />Inspectable down to the row</h2><p className={styles.accountLead}>The pipeline, dashboard and Genie are running in the recorded workspace build. The repository also contains newer source-permission, deletion and validation controls that still need to be deployed and checked there.</p><SourceLink path="spec/databricks-build.md">See what is built and deployed</SourceLink>
      <div className={styles.platformGrid}>
        <ol className={styles.platformList}>{platform.map((item, index) => <li key={item.name} className={index === 3 ? styles.basis : ''}>
          <span className={styles.number}>{index + 1}</span><div><p className={styles.toolName}>{item.name}</p><h3>{item.title}</h3><p className={styles.toolText}>{item.text}</p><SourceLink path={item.path}>{item.link}</SourceLink></div>
        </li>)}</ol>
        <aside className={styles.engineeringNote}><p className={styles.eyebrow}>What we added</p><p className={styles.statement}>Databricks tracks where tables and columns came from. We added a check for the records behind each saved estimate.</p><p>A matching fingerprint means the cited records have not changed. It does not tell us whether those records were reliable or the price was accurate.</p><details><summary>What can this check verify?</summary><p>The SQL function computes a hash, or fingerprint, from the cited records and compares it with the saved one. It reports missing rows or changed evidence. If a citation used weights that were not saved, it returns “weights not stored” rather than claiming to reproduce the calculation.</p><p>Databricks would not allow a table constraint alongside row-level filters. Our implementation checks for missing citations before a number is published, then uses a validation job and SQL alert to catch records that bypass that check.</p><SourceLink path="databricks/sql/07_why.sql">Read the checks and failure reasons</SourceLink></details><SourceLink path="databricks/DEMO.md">Walk through the Databricks build</SourceLink></aside>
      </div>
    </section>

    <section id="pricing-result" className={`${styles.resultSection} marketing-atmosphere`} data-tone="evidence" aria-labelledby="result-title"><div className={styles.wrap}>
      <p className={styles.eyebrow}>Testing on past sales</p><h2 id="result-title">84% fewer big pricing misses</h2><p className={styles.resultLead}>We tested both methods on the same historical StockX sales. A big miss means an estimate more than 20% above or below the actual sale price.</p>
      <figure className={styles.chart} aria-label="Big pricing misses in paired historical StockX sales: 90-day median 9.8 percent, research model 1.5 percent. Lower is better.">
        <figcaption>Share of estimates more than 20% from the sale price <span>Lower is better</span></figcaption>
        <div className={styles.chartRow}><span>90-day median</span><div className={styles.track}><div className={styles.baselineBar} /></div><span className={styles.value}>9.8%</span></div>
        <div className={styles.chartRow}><span>Research model</span><div className={styles.track}><div className={styles.modelBar} /></div><span className={styles.value}>1.5%</span></div>
        <div className={styles.axis} aria-hidden="true"><span>0%</span><span>2%</span><span>4%</span><span>6%</span><span>8%</span><span>10%</span></div>
      </figure>
      <div className={styles.resultFoot}><p>Historical sneaker research. This model is separate from the engine served in the app.</p><a className={styles.link} href="#method">Method and limits <Icon name="arrow-down-01" size={16} /></a></div>
      <details id="method" className={styles.method} open>
        <summary>What we measured</summary>
        <div className={styles.methodGrid}>
          <p>Both methods priced the same 39,707 StockX sneaker sales from November 2018 to February 2019. The 84% reduction comes from this period, which we also used to find and fix a pricing error.</p>
          <p>We ran the fixed model on eight earlier months we hadn’t used while developing it. On the same 35,862 sales, 90.5% of the 90-day median estimates were within 20% of the sale price, compared with 97.5% for the research model.</p>
          <p>Both runs use deadstock sneakers: unworn shoes sold on the resale market. They do not measure results on used clothing, money saved, faster sales or live app accuracy. The app’s pricing engine has a separate evaluation.</p>
        </div>
        <div className={styles.sourceLinks}>
          <SourceLink path="scripts/bench/out/backtest-stockx.json">Development results</SourceLink>
          <SourceLink path="scripts/bench/out/backtest-stockx-2018-03-to-10.json">Unseen-month results</SourceLink>
          <SourceLink path="spec/engines/valuation.md#9-proof">Current pricing engine evaluation</SourceLink>
        </div>
      </details>
    </div></section>

    <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="limits-title"><p className={styles.eyebrow}>Where the evidence runs thin</p><h2 id="limits-title">A price needs context</h2><div className={styles.limitGrid}><div><h3>Similar items can sell for different prices</h3><p>Wear, missing parts and the age of a sale can change what a comparison is worth. With few recent sales of similar items, there is less evidence for a precise estimate.</p></div><div><h3>Small samples can mislead</h3><p>The Databricks report leaves a rate blank until it has at least 30 shown prices. The app uses separate rules to decide when to widen a price range or look for other comparisons.</p><SourceLink path="databricks/DEMO.md">Inspect the reporting rules</SourceLink></div></div></section>

    <section id="your-data" className={`${styles.wrap} ${styles.section} ${styles.accountSection}`} aria-labelledby="account-title"><p className={styles.eyebrow}>Your account data</p><h2 id="account-title">What each input is for</h2><p className={styles.accountLead}>These are our planned data uses and controls. Some controls are still being built.</p>
      <dl className={styles.accountData}><div><dt>Photos and item details</dt><dd>Identify the item, record its condition and prepare the listing. You review the facts and photos before approving them.</dd></div><div><dt>Searches and preferences</dt><dd>Find items in your size, budget and preferred condition. The plan uses your corrections for your own results; using them to train a shared model requires your opt-in.</dd></div><div><dt>Marketplace connections</dt><dd>Read the listings, messages and orders needed for actions you authorize. The plan keeps marketplace sign-in credentials out of model prompts and logs.</dd></div></dl>
      <div className={styles.nextLinks}><SourceLink path="spec/data-use.md">Read the data-use plan</SourceLink><Link className={styles.link} href="/faq">Questions about permissions <Icon name="arrow-right-01" size={16} /></Link><Link className={styles.link} href="/features">See what this makes possible <Icon name="arrow-right-01" size={16} /></Link></div>
    </section>
  </main>;
}
