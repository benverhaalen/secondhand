import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import styles from './faq.module.css';

export const metadata: Metadata = {
  title: 'FAQ · secondhand',
  description: 'Answers about who approves listings, duplicate sales, photo edits, pricing evidence and marketplace accounts.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const groups = [
  { id: 'what-is-proven', label: 'What works today', questions: [
    ['working-today', 'What can I use today?'],
    ['accuracy-claim', 'Does the 84% result apply to my clothes?'],
    ['why-databricks', 'Why use Databricks?'],
  ] },
  { id: 'your-decisions', label: 'Your decisions', questions: [
    ['who-can-post', 'Who can post from my account?'],
    ['two-sites', 'What if the same item sells on two sites?'],
    ['payments-and-returns', 'Who handles payments and returns?'],
  ] },
  { id: 'prices-and-photos', label: 'Prices and photos', questions: [
    ['price-evidence', 'How do I know the price fits my item?'],
    ['sparse-evidence', 'What if there are too few comparable sales?'],
    ['photo-edits', 'Can a photo edit hide a flaw?'],
  ] },
  { id: 'accounts-and-cost', label: 'Accounts and cost', questions: [
    ['marketplace-rules', 'Could a marketplace limit my account?'],
    ['disconnect', 'Can I disconnect a marketplace?'],
    ['cost', 'What does secondhand cost?'],
  ] },
];

function Source({ path, children }: { path: string; children: React.ReactNode }) {
  return <a className={styles.textLink} href={`${repo}${path}`}>{children}<Icon name="arrow-right-01" size={16} /></a>;
}

function Answer({ id, question, children }: { id: string; question: string; children: React.ReactNode }) {
  return <article id={id} className={styles.answer} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}><a href={`#${id}`}>{question}<span className={styles.permalink} aria-hidden="true">#</span></a></h3>
    <div className={styles.answerBody}>{children}</div>
  </article>;
}

function QuestionGroup({ group, title, children }: { group: typeof groups[number]; title: string; children: React.ReactNode }) {
  return <section id={group.id} className={`${styles.group} ${styles.readingLayout}`} aria-labelledby={`${group.id}-title`}>
    <aside className={styles.sidebar}>
      <nav className={styles.questionIndex} aria-label={group.label}>
        <p className={styles.indexHeading}>{group.label}</p>
        <ul>{group.questions.map(([id, question]) => <li key={id}><a href={`#${id}`}>{question}</a></li>)}</ul>
      </nav>
    </aside>
    <div className={styles.answers}>
      <h2 id={`${group.id}-title`}>{title}</h2>
      {children}
    </div>
  </section>;
}

export default function FAQ() {
  return <main id="main" className={styles.page}>
    <header className={`${styles.hero} marketing-atmosphere`} data-tone="questions">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>FAQ</p>
        <h1 className="marketing-page-title">Before you start</h1>
        <p className={styles.intro}>What you can try, what we have tested, and how accounts, listings and payments work.</p>
        <nav className={styles.topIndex} aria-label="Question groups">
          {groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.label}<Icon name="arrow-down-01" size={16} /></a>)}
        </nav>
      </div>
    </header>

    <div className={`${styles.wrap} ${styles.readingWrap}`}>
      <QuestionGroup group={groups[0]} title="What works today">
          <Answer id="working-today" question="What can I use today?">
            <p>Upload photos, review the item details and asking price, then copy the listing to finish on your chosen marketplace. Automatic posting and removal after a sale still need to be connected to live marketplace accounts.</p>
            <p>We have tested marketplace reads, pricing, photo checks and duplicate-payment rules separately. Next we need to show them working together through a real sale.</p>
            <Source path="product/qa.md#before-you-say-it-the-honesty-gate">See what has been tested</Source>
            <Link className={styles.textLink} href="/whats-next">See what comes next <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
          <Answer id="accuracy-claim" question="Does the 84% result apply to my clothes?">
            <p>We have not measured that improvement on used clothing. In the historical StockX test, both methods priced the same 39,707 sneaker sales. Estimates more than 20% from the sale price fell from 9.8% with a 90-day median to 1.5% with our research model.</p>
            <p>We found and fixed a pricing error during that test, then ran the fixed model on eight months it had not seen during development. Both tests used deadstock sneakers, meaning unworn resale shoes, and a research model separate from the app’s pricing engine.</p>
            <Link className={styles.textLink} href="/data-use#pricing-result">Inspect the benchmark and limits <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
          <Answer id="why-databricks" question="Why use Databricks?">
            <p>We use Lakeflow to validate incoming records, Unity Catalog for access policies, Delta for data history, and MLflow to retain experiment settings and results. The dashboard and Genie use shared metric definitions so a question and a chart refer to the same measure.</p>
            <p>We added a SQL check that follows an estimate back to its source records and detects missing or changed evidence. It does not verify whether the source itself was correct. Newer data controls are written but still need to be deployed to the workspace.</p>
            <Link className={styles.textLink} href="/data-use#databricks">Inspect the architecture and its limits <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
      </QuestionGroup>

      <QuestionGroup group={groups[1]} title="Your decisions">
          <Answer id="who-can-post" question="Who can post from my account?">
            <p>You do. Review the photos, title and price in secondhand, then finish posting on your chosen marketplace.</p>
            <p>Buyer replies are planned as drafts you edit and send. Approving a listing would not also approve its messages.</p>
            <Source path="spec/features/list.md">See the listing design</Source>
            <Source path="product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves">Why replies start as drafts</Source>
          </Answer>
          <Answer id="two-sites" question="What if the same item sells on two sites?">
            <p>A second buyer can pay before the other listing comes down. Our planned workflow flags both orders so you can choose which sale to keep and resolve the other with the buyer.</p>
            <p>We tested this rule in a model of four marketplaces. The model flagged every situation with multiple paid orders in that run. We still need to measure how quickly listings come down on live marketplaces.</p>
            <Source path="scripts/bench/out/bench-sites-4.json">Read the model test · November 15, 2026</Source>
          </Answer>
          <Answer id="payments-and-returns" question="Who handles payments and returns?">
            <p>You pay and handle returns through the marketplace, under its rules. secondhand does not hold the payment.</p>
            <p>Protections can differ for local pickup. Check the marketplace’s rules for your transaction before agreeing to a purchase or refund.</p>
            <Source path="product/qa.md">Read the payment and pickup decisions</Source>
          </Answer>
      </QuestionGroup>

      <QuestionGroup group={groups[2]} title="Prices and photos">
          <Answer id="price-evidence" question="How do I know the price fits my item?">
            <p>A useful estimate needs comparable items, their condition and what buyers actually paid. An asking price only tells you what a seller wants.</p>
            <p>The pricing design links an estimate to its source sales so you can check the comparison yourself.</p>
            <Link className={styles.textLink} href="/data-use">Explore Data Use <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
          <Answer id="sparse-evidence" question="What if there are too few comparable sales?">
            <p>When exact matches are scarce, the pricing design looks at related products or categories and gives a wider range. It records which comparisons it used.</p>
            <p>If those comparisons cannot support a price, the design calls for more research instead of a number.</p>
            <Source path="spec/engines/valuation.md">Read the pricing and fallback design</Source>
          </Answer>
          <Answer id="photo-edits" question="Can a photo edit hide a flaw?">
            <p>Yes. An edit can remove a stain, change a label or distort the item. That is why edited photos need to be checked against the original and reviewed before posting.</p>
            <p>In our test, the photo check caught 173 of 174 deliberately altered images across 19 original photos. It also held 17 of 38 honest lighting changes.</p>
            <Source path="scripts/bench/out/gate.json">See both sides of the photo test</Source>
          </Answer>
      </QuestionGroup>

      <QuestionGroup group={groups[3]} title="Accounts and cost">
          <Answer id="marketplace-rules" question="Could a marketplace limit my account?">
            <p>Yes. Marketplaces set their own rules for account access and automation. Even an action you approve can violate those rules; a working integration is not the same as marketplace approval.</p>
            <p>The connection design uses eBay’s official sign-in and signed-in browser sessions where we lack partner access. The connection documentation lists each method and its known limits.</p>
            <Source path="spec/features/connect.md">See connection methods and known limits</Source>
          </Answer>
          <Answer id="disconnect" question="Can I disconnect a marketplace?">
            <p>The planned disconnect control stops work on that account and revokes its connection. It does not remove live listings; those need to be taken down separately.</p>
            <p>Disconnecting also needs to stay separate from deleting your account and its stored data.</p>
            <Source path="spec/features/connect.md">Read the disconnection design</Source>
            <Link className={styles.textLink} href="/data-use">See how data is used <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
          <Answer id="cost" question="What does secondhand cost?">
            <p>Our goal is to keep the core buying and selling tools free. The proposed business model uses buying referrals, optional paid tools and a plan for higher-volume sellers. Customer pricing is still being worked out.</p>
            <p>Marketplace fees still apply. We are measuring preparation and monitoring costs to see whether that business model covers real usage.</p>
            <Link className={styles.textLink} href="/whats-next">See the business plan <Icon name="arrow-right-01" size={16} /></Link>
          </Answer>
      </QuestionGroup>
    </div>

    <section className={styles.next} aria-labelledby="next-title">
      <div className={styles.wrap}>
        <h2 id="next-title">See the selling steps</h2>
        <p>From your first photo to the listing you approve.</p>
        <Link className={`${styles.pill} marketing-pill`} href="/how-it-works">See how it works <Icon name="arrow-right-01" size={16} /></Link>
      </div>
    </section>
  </main>;
}
