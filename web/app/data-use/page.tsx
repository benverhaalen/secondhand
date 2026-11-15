import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Data Use · secondhand',
  description: 'Follow the records behind a price, inspect our Databricks architecture, and see how we tested estimates on historical sales.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const platform = [
  { name: 'Lakeflow', title: 'Check records as they arrive.', text: 'The pipeline turns raw CSV values into typed records. It drops invalid prices and stops an update when source identity or model-use permission is missing. Each row keeps its source and recorded permissions.', path: 'databricks/pipelines/market/comp.sql', link: 'Inspect the pipeline' },
  { name: 'Unity Catalog', title: 'Control who can read each record.', text: 'Row filters restrict personal records to mapped accounts. Column masks obscure buyer and seller handles for readers outside the support group. Catalog policies apply these rules to tagged tables.', path: 'databricks/sql/02_governance.sql', link: 'Inspect the access policies' },
  { name: 'Delta', title: 'Keep the history of a pricing change.', text: 'Change data feed records changes to pricing parameters. Loaders merge updates and refuse data from erased accounts. A separate job removes current records and schedules deletion of retained files.', path: 'databricks/DEMO.md#6-deletion', link: 'Inspect the deletion workflow' },
  { name: 'Databricks SQL', title: 'Check the records behind an estimate.', text: 'Our SQL function returns the cited rows for a saved estimate. It checks their fingerprint against the one stored with the estimate, so we can detect missing or changed evidence.', path: 'databricks/sql/07_why.sql', link: 'Inspect the SQL function' },
  { name: 'MLflow', title: 'Keep model comparisons reproducible.', text: 'Historical tests record their settings, results and the Delta table version they used. In our monthly experiment, a proposed pricing weight replaces the current one only when the improvement exceeds measured noise.', path: 'databricks/tasks/param_walk.py', link: 'Inspect the experiment' },
  { name: 'AI/BI and Genie', title: 'Make the results easy to question.', text: 'The dashboard and Genie share the same metric definitions. We provide example SQL for the questions, and keep rates blank when they cover fewer than 30 shown prices.', path: 'databricks/genie-answers.md', link: 'Read the questions, answers and SQL' },
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
    <header className={`${styles.hero} marketing-atmosphere`} data-tone="evidence">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Data Use</p>
        <h1 className="marketing-page-title">The data architecture driving intelligence</h1>
        <p className={styles.lead}>Follow a price back to the sales behind it.</p>
        <figure className={styles.architecture} aria-label="Source records pass through quality and rights checks. Usable evidence supports an inspectable price. Other records are excluded or kept for display only.">
          <div className={styles.flow}>
            <div className={styles.node}><DataIcon kind="records" /><h2>Source records</h2><p>Sold prices, asking prices, dates and item details.</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="check" /><h2>Quality and usage checks</h2><p>Is the record valid? Is this use permitted?</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="database" /><h2>Usable evidence</h2><p>Comparable records with their source and date.</p></div>
            <Icon name="arrow-right-01" size={20} className={styles.connector} />
            <div className={styles.node}><DataIcon kind="price" /><h2>A price you can inspect</h2><p>The estimate and the sales it rests on.</p></div>
          </div>
          <figcaption className={styles.branch}><span aria-hidden="true">↳</span> Excluded or display only <span className={styles.branchReason}>Invalid records are rejected. Model-use permission is checked separately.</span></figcaption>
        </figure>
        <nav className={styles.jumpLinks} aria-label="On this page"><a className={styles.primary} href="#pipeline">Follow the pipeline <Icon name="arrow-down-01" size={16} /></a><a className={styles.secondary} href="#pricing-result">See the pricing result <Icon name="arrow-down-01" size={16} /></a><a className={styles.quiet} href="#your-data">Your account data <Icon name="arrow-down-01" size={16} /></a></nav>
      </div>
    </header>

    <section id="pipeline" className={`${styles.wrap} ${styles.section}`} aria-labelledby="pipeline-title">
      <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>The data pipeline</p><h2 id="pipeline-title">A sold price is different<br />from an asking price</h2></div><p>We preserve that distinction alongside the source, date and recorded permissions. A separate view admits only rows marked for model use.</p></div>
      <div className={styles.recordTable} role="table" aria-label="Illustrative data decisions">
        <div className={styles.tableHead} role="row"><span role="columnheader">Record</span><span role="columnheader">What it tells us</span><span role="columnheader">In this example</span></div>
        <div className={`${styles.record} ${styles.used}`} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">✓</span>Sold price</span><span role="cell">A comparable item sold, with permitted use.</span><span role="cell">Eligible as evidence</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">○</span>Asking price</span><span role="cell">What a seller wants. No completed sale.</span><span role="cell">Market context</span></div>
        <div className={styles.record} role="row"><span role="cell"><span className={styles.recordIcon} aria-hidden="true">×</span>Invalid price</span><span role="cell">The price is zero or below.</span><span role="cell">Excluded</span></div>
      </div>
      <p className={styles.caption}>Illustrative records. Price validation and the model-use filter are separate checks in the pipeline.</p>
      <SourceLink path="databricks/pipelines/market/comp_for_model.sql">See which rows can enter a model</SourceLink>
    </section>

    <section id="databricks" className={`${styles.wrap} ${styles.section} ${styles.platformSection}`} aria-labelledby="databricks-title">
      <p className={styles.eyebrow}>Databricks</p><h2 id="databricks-title">Built on Databricks.<br />Inspectable down to the row</h2>
      <div className={styles.platformGrid}>
        <ol className={styles.platformList}>{platform.map((item, index) => <li key={item.name} className={index === 3 ? styles.basis : ''}>
          <span className={styles.number}>{index + 1}</span><div><p className={styles.toolName}>{item.name}</p><h3>{item.title}</h3><p className={styles.toolText}>{item.text}</p><SourceLink path={item.path}>{item.link}</SourceLink></div>
        </li>)}</ol>
        <aside className={styles.engineeringNote}><p className={styles.eyebrow}>What we added</p><p className={styles.statement}>Databricks tracks where tables and columns came from. We added a check for the records behind each saved estimate.</p><p>A match confirms that the saved evidence is consistent. Source reliability and pricing accuracy need their own checks.</p><details><summary>What can this check verify?</summary><p>The function rebuilds a hash, a fingerprint of the cited records, and compares it with the saved hash. Missing rows or mismatches return a reason. Weighted citations return “weights not stored” because their saved evidence is not enough to reconstruct the weights.</p><p>A separate Databricks limitation prevented a table constraint on filtered records. We check for missing citations before publication and monitor them with a guard job and SQL alert.</p><SourceLink path="databricks/sql/07_why.sql">Read the checks and failure reasons</SourceLink></details><SourceLink path="databricks/DEMO.md">Walk through the Databricks build</SourceLink></aside>
      </div>
    </section>

    <section id="pricing-result" className={`${styles.resultSection} marketing-atmosphere`} data-tone="evidence" aria-labelledby="result-title"><div className={styles.wrap}>
      <p className={styles.eyebrow}>Testing on past sales</p><h2 id="result-title">84% fewer big pricing misses</h2><p className={styles.resultLead}>We compared estimates for the same historical sales. A big miss means a price more than 20% above or below the actual sale price.</p>
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
          <p>The 84% comes from 39,707 paired StockX sneaker sales from November 2018 to February 2019. This was the development window in which we found and fixed a pricing error.</p>
          <p>We ran the fixed model on eight earlier months we hadn’t used while developing it. In 35,862 paired sales, estimates within 20% of the sale price rose from 90.5% with the 90-day median to 97.5% with the research model.</p>
          <p>Both runs measured estimates on historical sneaker sales. The app’s current pricing engine has its own evaluation.</p>
        </div>
        <div className={styles.sourceLinks}>
          <SourceLink path="scripts/bench/out/backtest-stockx.json">Development results</SourceLink>
          <SourceLink path="scripts/bench/out/backtest-stockx-2018-03-to-10.json">Unseen-month results</SourceLink>
          <SourceLink path="spec/engines/valuation.md#9-proof">Current pricing engine evaluation</SourceLink>
        </div>
      </details>
    </div></section>

    <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="limits-title"><p className={styles.eyebrow}>Where the evidence runs thin</p><h2 id="limits-title">A price needs context</h2><div className={styles.limitGrid}><div><h3>An asking price is a different signal</h3><p>A listing tells us what a seller wants. A completed sale tells us what a buyer paid. Sparse sales, different conditions and old records all affect how much an estimate can tell you.</p></div><div><h3>Small samples need a visible limit</h3><p>The Databricks report displays a rate only when it has at least 30 shown prices. The app has separate rules for its price ranges and fallback evidence. A historical sneaker result cannot stand in for every item in your closet.</p><SourceLink path="databricks/DEMO.md">Inspect the reporting rules</SourceLink></div></div></section>

    <section id="your-data" className={`${styles.wrap} ${styles.section} ${styles.accountSection}`} aria-labelledby="account-title"><p className={styles.eyebrow}>Your account data</p><h2 id="account-title">What each input is for</h2><p className={styles.accountLead}>This is the product’s data-use plan: what each input is for and the control a person should have. These are intended rules, not a claim that every control is live.</p>
      <dl className={styles.accountData}><div><dt>Photos and item details</dt><dd>Identify the item, record the condition you provide and prepare its listing. The plan gives you a review of the facts and photos before approval.</dd></div><div><dt>Searches and preferences</dt><dd>Find items that fit your size, budget and condition preferences. Personal corrections are intended to affect your own results; shared training requires opt-in.</dd></div><div><dt>Marketplace connections</dt><dd>Read the listings, messages and orders needed for authorized actions. The plan keeps connection credentials out of model prompts and logs.</dd></div></dl>
      <div className={styles.nextLinks}><SourceLink path="spec/data-use.md">Read the data-use plan</SourceLink><Link className={styles.link} href="/faq">Questions about permissions <Icon name="arrow-right-01" size={16} /></Link><Link className={styles.link} href="/features">See what this makes possible <Icon name="arrow-right-01" size={16} /></Link></div>
    </section>
  </main>;
}
