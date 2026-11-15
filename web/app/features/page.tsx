import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './features.module.css';

export const metadata: Metadata = {
  title: 'Features · secondhand',
  description: 'The decisions behind secondhand: check item facts, compare take-home, review listings and find what fits. See the engineering and compare the tools.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const chapters = [
  ['01', 'Prepare a listing', 'prepare'],
  ['02', 'Compare what you keep', 'take-home'],
  ['03', 'Find what fits', 'find'],
  ['04', 'Follow through', 'follow-through'],
];

function Source({ path, children }: { path: string; children: React.ReactNode }) {
  return <a className={styles.source} href={`${repo}${path}`}>{children}<span aria-hidden="true"> ↗</span></a>;
}

function StepIcon({ type }: { type: 'facts' | 'listing' | 'approve' }) {
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {type === 'facts' ? <><path d="M8 3h11l6 6v20H8V3Z"/><path d="M19 3v7h6M12 15h9M12 20h9M12 25h5"/></> : type === 'listing' ? <><rect x="4" y="5" width="24" height="22" rx="3"/><path d="m4 23 7-8 6 6 4-5 7 8"/><circle cx="21" cy="11" r="2"/></> : <><circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-9"/></>}
  </svg>;
}

export default function Features() {
  return <main id="main" className={styles.page}>
    <section className={styles.hero} aria-labelledby="features-title">
      <div className={`${styles.wrap} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Features</p>
          <h1 id="features-title">The decisions<br className={styles.desktopBreak}/> behind secondhand.</h1>
          <p className={styles.intro}>See how we price an item, prepare a listing and bring the important choices back to you.</p>
          <nav className={styles.index} aria-label="On this page">
            {chapters.map(([number, name, id]) => <a key={id} href={`#${id}`}><span>{number}</span><span>{name}</span><span aria-hidden="true">→</span></a>)}
            <a href="#compare"><span>05</span><span>Compare the tools</span><span aria-hidden="true">→</span></a>
          </nav>
        </div>
        <figure className={styles.heroFigure}>
          <img src="/marketing/app/preview.png" width="880" height="1840" alt="Secondhand listing review for a gold Marquette tee, with separate eBay and Depop previews, editable prices and a final posting action." fetchPriority="high" />
          <figcaption>Your item. Your price. Your approval.<span>App preview · Sample data</span></figcaption>
        </figure>
      </div>
    </section>

    <section id="prepare" className={`${styles.section} ${styles.wrap}`} aria-labelledby="prepare-title">
      <p className={styles.eyebrow}>Prepare a listing</p>
      <h2 id="prepare-title">A listing starts with<br/> facts you can check.</h2>
      <div className={styles.steps}>
        <article><StepIcon type="facts"/><h3>Read the item.</h3><p>Pull the details from your photos. Check the brand, size and condition before they reach a buyer.</p><Source path="spec/engines/capture.md">How capture works</Source></article>
        <article><StepIcon type="listing"/><h3>Prepare each listing.</h3><p>Turn the same item facts into a title, photos and price for each marketplace you choose.</p><Source path="spec/features/list.md">The listing design</Source></article>
        <article><StepIcon type="approve"/><h3>You approve.</h3><p>Review what will be posted, see the expected take-home and change the details before you approve.</p><Source path="spec/features/list.md">Review and posting</Source></article>
      </div>
      <div className={styles.reasonBand}><div><h3>One item record. A preview for each marketplace.</h3><p>A wrong size or condition can change the price. Keeping the facts together helps each listing describe the same thing, even when the forms differ.</p></div><Source path="spec/engines/protocol-and-adapters.md">Inside the adapters</Source></div>
      <details className={styles.disclosure}>
        <summary><span>What we got wrong: a better-looking photo can change the item.</span><span className={styles.expand} aria-hidden="true">+</span></summary>
        <div className={styles.disclosureBody}><p>A photo edit can remove a flaw that a buyer needs to see. We tested the photo check with deliberately altered images and honest lighting changes.</p><div className={styles.testResults}><p><span>173 / 174</span>planted edits caught across 19 photos</p><p><span>17 / 38</span>honest relights also held for review</p></div><p>The check caught almost all planted edits, but it also held good ones. That tradeoff is visible in the results; it is a reason to keep review in the process.</p><Source path="scripts/bench/out/gate.json">Read the full photo test</Source></div>
      </details>
    </section>

    <section id="take-home" className={`${styles.section} ${styles.wrap}`} aria-labelledby="take-home-title">
      <div className={styles.chartHeading}><div><p className={styles.eyebrow}>Compare what you keep</p><h2 id="take-home-title">Same sale.<br/>Different take-home.</h2></div><p className={styles.metric}><span>$2.69</span>more to keep in this example</p></div>
      <figure className={styles.chart}>
        <figcaption>What you keep on the same $20 sale</figcaption>
        <div className={styles.barRows}>
          <div className={styles.barRow}><span>Depop</span><div className={styles.track}><div className={styles.depopBar}/></div><span>$18.69</span></div>
          <div className={styles.barRow}><span>Poshmark</span><div className={styles.track}><div className={styles.poshmarkBar}/></div><span>$16.00</span></div>
          <div className={styles.axis} aria-hidden="true"><span>$0</span><span>$5</span><span>$10</span><span>$15</span><span>$20</span></div>
        </div>
        <div className={styles.chartFoot}><p>Fee calculation, November 14, 2026. Buyer pays $6 shipping; label cost passes through. No tax or boost. This compares fees, not the chance of a sale.</p><Source path="scripts/bench/out/bench-sites-4.json">See the calculation</Source></div>
      </figure>
      <p className={styles.afterChart}>The asking price is only part of the decision. Showing the payout beside it helps you choose where to list with both amounts in view.</p>
    </section>

    <section id="find" className={styles.find} aria-labelledby="find-title">
      <div className={`${styles.wrap} ${styles.findGrid}`}>
        <div><p className={styles.eyebrow}>Find what fits</p><h2 id="find-title">A good match has<br/> to fit your life.</h2><p className={styles.intro}>A low price means little if it is the wrong size, too worn or expensive to ship.</p><dl className={styles.criteria}><div><dt>Your size</dt><dd>The fit and cut you are looking for.</dd></div><div><dt>Your budget</dt><dd>What you would pay, including delivery.</dd></div><div><dt>Your condition</dt><dd>How much wear you are willing to accept.</dd></div><div><dt>Missing details</dt><dd>Visible before you decide to buy.</dd></div></dl><Source path="spec/features/watch.md">How a want becomes a search</Source></div>
        <figure className={styles.watchFigure}><img src="/marketing/app/watch.png" width="880" height="1840" loading="lazy" decoding="async" alt="Secondhand Watch screen with a Brewers jersey request and controls for fit, budget and delivery."/><figcaption>Tell it what counts as a match.<span>App preview · Sample data</span></figcaption></figure>
      </div>
    </section>

    <section id="follow-through" className={`${styles.section} ${styles.wrap}`} aria-labelledby="follow-title">
      <p className={styles.eyebrow}>Follow through</p>
      <h2 id="follow-title">The work does not<br/> stop at posting.</h2>
      <div className={styles.followRows}>
        <article><span className={styles.rowNumber}>01</span><h3>Read before retrying.</h3><p>A slow response does not mean a post failed. The posting design checks the marketplace before trying again, and confirms a listing only after reading it back.</p><Source path="spec/engines/protocol-and-adapters.md">Posting safeguards</Source></article>
        <article><span className={styles.rowNumber}>02</span><h3>Bring conflicts back to you.</h3><p>If two buyers pay, someone needs a decision. We tested the rule across possible orderings of sales, payments and failed removals.</p><Source path="scripts/bench/out/bench-sites-4.json">The model check</Source></article>
        <article><span className={styles.rowNumber}>03</span><h3>Draft the reply.<br/>Let the person send it.</h3><p>A draft can prepare the answer. You review the exact words and choose to send them.</p><Source path="spec/features/messages.md">The message design</Source></article>
      </div>
      <details className={styles.disclosure}><summary><span>What did the duplicate-payment test establish?</span><span className={styles.expand} aria-hidden="true">+</span></summary><div className={styles.disclosureBody}><p>The model checked 931,406 possible states for one item on four marketplaces. All 522,560 states with two or more payments were flagged.</p><p>This is a bounded model check, including simulated failures. It does not establish that every live double sale will be detected or that a refund has happened.</p><Source path="scripts/bench/out/bench-sites-4.json">Inspect the states and result</Source></div></details>
    </section>

    <section id="compare" className={`${styles.section} ${styles.wrap}`} aria-labelledby="compare-title">
      <p className={styles.eyebrow}>The alternatives</p>
      <h2 id="compare-title">Compare the work<br/> and the cost.</h2>
      <p className={styles.intro}>Choose the job you need. These tools overlap, and each has its own strengths.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tool and subscription comparison; scroll horizontally on small screens">
        <table className={styles.comparison}>
          <caption>Published capabilities and monthly subscription prices</caption>
          <thead><tr><th scope="col">Tool</th><th scope="col">Useful for</th><th scope="col">Monthly price</th></tr></thead>
          <tbody>
            <tr><th scope="row"><a href="https://www.ebay.com/help/selling/selling-tools/product-research?id=4853">eBay Product Research ↗</a></th><td>Researching actual eBay sales, including accepted offers.</td><td><a href="https://www.ebay.com/sellercenter/resources/seller-updates/2024-summer/tools">Free for eligible sellers ↗</a></td></tr>
            <tr><th scope="row"><a href="https://fliptip.ai/">FlipTip Hustler ↗</a></th><td>Photo appraisal, sold-price lookup where supported, listing drafts and profit tracking.</td><td>$9.99 <span>US price listed in FAQ</span></td></tr>
            <tr><th scope="row"><a href="https://www.vendoo.co/pricing">Vendoo Starter ↗</a></th><td>Cross-listing, inventory management, sale detection and automatic delisting.</td><td>$14.99 <span>US, billed monthly</span></td></tr>
            <tr className={styles.ownRow}><th scope="row">secondhand</th><td>Pricing, listing review and finding in one workflow, with decisions returned to the person.</td><td>To be announced <span>Customer pricing is not set</span></td></tr>
          </tbody>
        </table>
      </div>
      <p className={styles.tableNote}>Provider documentation checked November 15, 2026. This is a selection of capabilities, not an exhaustive feature list. Plans, regions and limits differ. Marketplace fees are separate. FlipTip has additional publishing and automation features on higher plans.</p>
      <details className={styles.disclosure}><summary><span>How do speed and accuracy compare?</span><span className={styles.expand} aria-hidden="true">+</span></summary><div className={styles.disclosureBody}><p>We have not completed a matched, end-to-end comparison against these products. A marketplace read time is not the time to finish a listing, and a test on one dataset cannot rank a product tested on another.</p><p>The comparison needs the same items, task and endpoint, with corrections and completed attempts recorded alongside the time.</p><Source path="product/numbers.md">Read the measurement plan</Source></div></details>
      <div className={styles.next}><div><p className={styles.eyebrow}>Dig into the evidence</p><h3>What is behind the price?</h3><p>Follow the records, checks and decisions through our data system.</p></div><Link className={styles.pill} href="/data-use">Explore Data Use <span aria-hidden="true">→</span></Link></div>
    </section>
  </main>;
}
