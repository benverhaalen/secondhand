import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { AppPreviewImage } from '../../components/marketing/app-preview-image';
import styles from './features.module.css';

export const metadata: Metadata = {
  title: 'Features · secondhand',
  description: 'How secondhand checks item details, researches prices and prepares listings. Inspect the engineering, test results and tool comparison.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const chapters = [
  ['01', 'Prepare a listing', 'prepare'],
  ['02', 'Compare what you keep', 'take-home'],
  ['03', 'Find what fits', 'find'],
  ['04', 'Follow through', 'follow-through'],
];

function ExternalArrow() {
  return <svg className={styles.externalArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

function Source({ path, children }: { path: string; children: React.ReactNode }) {
  return <a className={styles.source} href={`${repo}${path}`}>{children}<ExternalArrow/></a>;
}

export default function Features() {
  return <main id="main" className={styles.page}>
    <section className={`${styles.hero} marketing-atmosphere`} data-tone="features" aria-labelledby="features-title">
      <div className={`${styles.wrap} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Features</p>
          <h1 id="features-title" className="marketing-page-title">How secondhand gets a listing ready</h1>
          <p className={styles.intro}>See how photos become item details, how sales inform a price, and why posting and buyer replies need your approval.</p>
          <nav className={styles.index} aria-label="On this page">
            {chapters.map(([number, name, id]) => <a key={id} href={`#${id}`}><span>{number}</span><span>{name}</span><Icon name="arrow-right-01" size={16} /></a>)}
            <a href="#compare"><span>05</span><span>Compare the tools</span><Icon name="arrow-right-01" size={16} /></a>
          </nav>
        </div>
        <figure className={styles.heroFigure}>
          <AppPreviewImage name="preview" alt="Secondhand listing review for a Carhartt jacket, with the photo, item details and asking price." sizes="(max-width: 1100px) 244px, 268px" eager />
        </figure>
      </div>
    </section>

    <section id="prepare" className={`${styles.section} ${styles.wrap}`} aria-labelledby="prepare-title">
      <p className={styles.eyebrow}>Prepare a listing</p>
      <h2 id="prepare-title">A listing starts with<br/> facts you can check</h2>
      <div className={styles.steps}>
        <article><Icon name="tag-01" /><h3>Read the item</h3><p>Read the brand, size and condition from your photos, then check those details before a buyer sees them.</p><Source path="spec/engines/capture.md">How capture works</Source></article>
        <article><Icon name="image-01" /><h3>Prepare the listing</h3><p>Build the title and description from the item details, with the photos and asking price beside them.</p><Source path="spec/features/list.md">The listing design</Source></article>
        <article><Icon name="checkmark-circle-02" /><h3>You approve</h3><p>Check the draft and edit the details. Copy them when you’re ready to finish on the marketplace.</p><Source path="spec/features/list.md">Review and posting</Source></article>
      </div>
      <div className={styles.reasonBand}><div><h3>One record for each item</h3><p>A wrong size or condition can change the price. Our marketplace adapters are designed to reuse one reviewed item record, so a correction carries into every listing. For now, you finish posting on the marketplace.</p></div><Source path="spec/engines/protocol-and-adapters.md">Inside the adapters</Source></div>
      <details className={styles.disclosure}>
        <summary><span>Can a photo edit change what you’re selling?</span><Icon name="add-01" size={20} className={styles.expand} /></summary>
        <div className={styles.disclosureBody}><p>A photo edit can remove a flaw that a buyer needs to see. We tested the photo check with deliberately altered images and honest lighting changes.</p><div className={styles.testResults}><p><span>173 / 174</span>planted edits caught across 19 photos</p><p><span>17 / 38</span>lighting-only edits also held for review</p></div><Source path="scripts/bench/out/gate.json">Read the full photo test</Source></div>
      </details>
    </section>

    <section id="take-home" className={`${styles.section} ${styles.wrap}`} aria-labelledby="take-home-title">
      <div className={styles.chartHeading}><div><p className={styles.eyebrow}>Compare what you keep</p><h2 id="take-home-title">Same sale.<br/>Different take-home</h2></div><p className={styles.metric}><span>$2.69</span>more after fees</p></div>
      <figure className={styles.chart}>
        <figcaption>Estimated take-home on a $20 sale</figcaption>
        <div className={styles.barRows}>
          <div className={styles.barRow}><span>Depop</span><div className={styles.track}><div className={styles.depopBar}/></div><span>$18.69</span></div>
          <div className={styles.barRow}><span>Poshmark</span><div className={styles.track}><div className={styles.poshmarkBar}/></div><span>$16.00</span></div>
          <div className={styles.axis} aria-hidden="true"><span>$0</span><span>$5</span><span>$10</span><span>$15</span><span>$20</span></div>
        </div>
        <div className={styles.chartFoot}><p>Calculated with our November 14, 2026 fee model: the buyer pays $6 for shipping, which covers the label. Tax and paid promotion are excluded. Actual fees depend on the marketplace and account; this calculation does not predict whether the item will sell.</p><Source path="scripts/bench/out/bench-sites-4.json">See the calculation</Source></div>
      </figure>
      <details className={styles.disclosure}>
        <summary><span>How does the research turn into a price?</span><Icon name="add-01" size={20} className={styles.expand} /></summary>
        <div className={styles.disclosureBody}><p>The research engine chooses sources for the question and gives each a deadline. It records failed and empty searches, then separates comparable items from lookalikes. The pricing design weighs the product match, condition, age of the sale and whether the price was actually paid.</p><p>Our first research model used brand, size and condition but missed which shoe it was pricing. Starting from that shoe’s recent sales fixed the error. The result was 84% fewer big pricing misses in the historical StockX benchmark. That result measures the research model, not the app’s pricing engine.</p><div><Source path="spec/engines/intelligence-api.md">Read the research engine design</Source></div><div><Source path="spec/plans/backtest/claims.md">Inspect the failure, fix and results</Source></div><div><Link className={styles.source} href="/data-use#pricing-result">See the full pricing comparison <Icon name="arrow-right-01" size={16} /></Link></div></div>
      </details>
    </section>

    <section id="find" className={styles.find} aria-labelledby="find-title">
      <div className={`${styles.wrap} ${styles.findGrid}`}>
        <div><p className={styles.eyebrow}>Find what fits</p><h2 id="find-title">A match needs more<br/> than a low price</h2><p className={styles.intro}>A low price means little if it is the wrong size, too worn or expensive to ship.</p><dl className={styles.criteria}><div><dt>Your size</dt><dd>The fit and cut you are looking for.</dd></div><div><dt>Your budget</dt><dd>What you would pay, including delivery.</dd></div><div><dt>Acceptable wear</dt><dd>How much wear you are willing to accept.</dd></div><div><dt>Missing details</dt><dd>Details the listing leaves unanswered.</dd></div></dl><Source path="spec/features/watch.md">How saved searches work</Source></div>
        <figure className={styles.watchFigure}><AppPreviewImage name="watch" alt="Brewers jersey tracking request with a target price, size and color." sizes="(max-width: 1100px) 244px, 268px" /></figure>
      </div>
    </section>

    <section id="follow-through" className={`${styles.section} ${styles.wrap}`} aria-labelledby="follow-title">
      <p className={styles.eyebrow}>Follow through</p>
      <h2 id="follow-title">The work does not<br/> stop at posting</h2>
      <div className={styles.followRows}>
        <article><span className={styles.rowNumber}>01</span><h3>Read before retrying</h3><p>A slow response does not mean a post failed. The posting design checks the marketplace before trying again, and confirms a listing only after reading it back.</p><Source path="spec/engines/protocol-and-adapters.md">Posting safeguards</Source></article>
        <article><span className={styles.rowNumber}>02</span><h3>Bring conflicts back to you</h3><p>If two buyers pay, both orders need your attention. We tested whether the rules flag that conflict when sales, payments and failed listing removals happen in different orders.</p><Source path="scripts/bench/out/bench-sites-4.json">The model check</Source></article>
        <article><span className={styles.rowNumber}>03</span><h3>Draft the reply.<br/>Let the person send it</h3><p>The messaging design prepares a draft for you to edit and send.</p><Source path="spec/features/messages.md">The message design</Source></article>
      </div>
      <details className={styles.disclosure}><summary><span>What did the duplicate-payment test show?</span><Icon name="add-01" size={20} className={styles.expand} /></summary><div className={styles.disclosureBody}><p>The model checked 931,406 possible states for one item on four marketplaces. All 522,560 states with two or more payments were flagged.</p><p>This test explores a defined model of marketplace behavior, including simulated failures. It does not prove that every live double sale will be detected or that a refund has been completed.</p><Source path="scripts/bench/out/bench-sites-4.json">Inspect the states and result</Source></div></details>
    </section>

    <section id="compare" className={`${styles.section} ${styles.wrap}`} aria-labelledby="compare-title">
      <p className={styles.eyebrow}>The alternatives</p>
      <h2 id="compare-title">Compare the work<br/> and the cost</h2>
      <p className={styles.intro}>Check what each tool handles and what its entry plan costs.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tool and subscription comparison; scroll horizontally on small screens">
        <table className={styles.comparison}>
          <caption>Published capabilities and monthly subscription prices</caption>
          <thead><tr><th scope="col">Tool</th><th scope="col">Useful for</th><th scope="col">Monthly price</th></tr></thead>
          <tbody>
            <tr><th scope="row"><a href="https://www.ebay.com/help/selling/selling-tools/product-research?id=4853">eBay Product Research <ExternalArrow/></a></th><td>Researching actual eBay sales, including accepted offers.</td><td><a href="https://www.ebay.com/sellercenter/resources/seller-updates/2024-summer/tools">Free for eligible sellers <ExternalArrow/></a></td></tr>
            <tr><th scope="row"><a href="https://fliptip.ai/">FlipTip Starter <ExternalArrow/></a></th><td>Photo appraisal, sold-price lookup where supported, listing drafts and profit tracking.</td><td>$1.99 <span>US · 40 scans per month</span></td></tr>
            <tr><th scope="row"><a href="https://www.vendoo.co/pricing">Vendoo Starter <ExternalArrow/></a></th><td>Cross-listing, inventory management, sale detection and automatic delisting.</td><td>$14.99 <span>US, billed monthly</span></td></tr>
            <tr className={styles.ownRow}><th scope="row">secondhand</th><td>Pricing from comparable sales, listing preparation and saved searches.</td><td>Pricing undecided</td></tr>
          </tbody>
        </table>
      </div>
      <p className={styles.tableNote}>Provider documentation checked November 15, 2026. Selected features are shown here. Plans, regions and usage limits differ. Marketplace fees are separate. FlipTip has additional publishing and automation features on higher plans.</p>
      <details className={styles.disclosure}><summary><span>How do speed and accuracy compare?</span><Icon name="add-01" size={20} className={styles.expand} /></summary><div className={styles.disclosureBody}><p>We have not compared these products on the same items from start to finish. Reading one marketplace page is only part of preparing a listing, and accuracy results from different datasets cannot tell us which product is better.</p><p>A fair test needs the same items and a common finish line. It should count corrections and completed listings as well as elapsed time.</p><Source path="product/numbers.md">Read the measurement plan</Source></div></details>
      <div className={styles.next}><div><p className={styles.eyebrow}>Dig into the evidence</p><h3>What is behind the price?</h3><p>Follow the records, checks and decisions through our data system.</p></div><Link className="marketing-pill" href="/data-use">Explore Data Use <Icon name="arrow-right-01" size={16} /></Link></div>
    </section>
  </main>;
}
