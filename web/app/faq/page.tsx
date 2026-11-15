import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './faq.module.css';

export const metadata: Metadata = {
  title: 'FAQ · secondhand',
  description: 'Answers about who approves listings, duplicate sales, photo edits, pricing evidence and marketplace accounts.',
};

const repo = 'https://github.com/benverhaalen/secondhand/blob/main/';
const groups = [
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
  return <a className={styles.textLink} href={`${repo}${path}`}>{children}<span aria-hidden="true"> ↗</span></a>;
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
    <header className={styles.hero}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>FAQ</p>
        <h1>before you start.</h1>
        <p className={styles.intro}>Answers about accounts, listings, payments and photos.</p>
        <nav className={styles.topIndex} aria-label="Question groups">
          {groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.label}<span aria-hidden="true"> ↓</span></a>)}
        </nav>
      </div>
    </header>

    <div className={`${styles.wrap} ${styles.readingWrap}`}>
      <QuestionGroup group={groups[0]} title="your decisions.">
          <Answer id="who-can-post" question="Who can post from my account?">
            <p>You review the photos, title and price for each marketplace before you approve a listing. Replies to buyers start as drafts, with the exact words waiting for you to send or edit.</p>
            <p>The design keeps permission for a listing separate from permission to send a message. Connecting an account should never stand in for approving what goes out.</p>
            <Source path="spec/features/list.md">See the listing design</Source>
            <Source path="product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves">Why replies start as drafts</Source>
          </Answer>
          <Answer id="two-sites" question="What if the same item sells on two sites?">
            <p>A second buyer can pay before the other listing comes down. The workflow is designed to flag both orders so you can decide which to keep and handle the other buyer.</p>
            <p>We tested this rule in a model of four marketplaces. Every state with multiple paid orders was flagged in that run. This checks the workflow logic. It does not measure how quickly a live marketplace takes a listing down.</p>
            <Source path="scripts/bench/out/bench-sites-4.json">Read the model test · November 15, 2026</Source>
          </Answer>
          <Answer id="payments-and-returns" question="Who handles payments and returns?">
            <p>For a marketplace checkout, the purchase stays on that marketplace and its payment and return rules apply. secondhand does not hold the payment.</p>
            <p>Local pickup can have different protections. Check the rules for the particular site and transaction before agreeing to a purchase or a refund.</p>
            <Source path="product/qa.md">Read the payment and pickup decisions</Source>
          </Answer>
      </QuestionGroup>

      <QuestionGroup group={groups[1]} title="prices and photos.">
          <Answer id="price-evidence" question="How do I know the price fits my item?">
            <p>A useful estimate needs comparable items, their condition and what buyers actually paid. An asking price only tells you what a seller wants.</p>
            <p>Our pricing design keeps the source sales behind an estimate so you can inspect the evidence. The data page explains how those records are checked, which comparisons we tested and where the results apply.</p>
            <Link className={styles.textLink} href="/data-use">Explore Data Use <span aria-hidden="true">→</span></Link>
          </Answer>
          <Answer id="sparse-evidence" question="What if there are too few comparable sales?">
            <p>An exact match is not always available. The pricing design can use related products or categories and widen the range as the evidence gets weaker. It records which level of comparison it used.</p>
            <p>If there is no defensible basis for a number, the design calls for more research. A broad category estimate should never look like a precise match for your item.</p>
            <Source path="spec/engines/valuation.md">Read the pricing and fallback design</Source>
          </Answer>
          <Answer id="photo-edits" question="Can a photo edit hide a flaw?">
            <p>Yes. An edit can remove a stain, change a label or distort the item. That is why edited photos need to be checked against the original and reviewed before posting.</p>
            <p>In our test, the photo check caught 173 of 174 deliberately altered images across 19 original photos. It also held 17 of 38 honest lighting changes. The check is useful, but it still makes mistakes.</p>
            <Source path="scripts/bench/out/gate.json">See both sides of the photo test</Source>
          </Answer>
      </QuestionGroup>

      <QuestionGroup group={groups[2]} title="accounts and cost.">
          <Answer id="marketplace-rules" question="Could a marketplace limit my account?">
            <p>Yes. Each marketplace sets its own rules for account access and automation. Your approval does not remove those rules, and support for an action does not mean the marketplace has approved our integration.</p>
            <p>Our connection design uses eBay’s official sign-in and signed-in sessions for sites where we do not have partner access. The site’s restrictions and the actions that have been verified need to be checked separately.</p>
            <Source path="spec/features/connect.md">See connection methods and known limits</Source>
          </Answer>
          <Answer id="disconnect" question="Can I disconnect a marketplace?">
            <p>The disconnection flow is designed to stop jobs for that account and revoke its connection. Taking down a listing is a separate action. Disconnecting should not be treated as proof that an item is no longer for sale.</p>
            <p>Account deletion and the data kept for a marketplace connection also need separate controls. The data page explains what each type of data is used for.</p>
            <Source path="spec/features/connect.md">Read the disconnection design</Source>
            <Link className={styles.textLink} href="/data-use">See how data is used <span aria-hidden="true">→</span></Link>
          </Answer>
          <Answer id="cost" question="What does secondhand cost?">
            <p>Our goal is to keep the core buying and selling tools free. The proposed business model uses buying referrals, optional paid tools and a plan for higher-volume sellers. Customer pricing is still being worked out.</p>
            <p>Marketplace fees still apply. We are measuring the cost of preparing listings and monitoring them so the plan can be judged against real usage.</p>
            <Link className={styles.textLink} href="/whats-next">See the business plan <span aria-hidden="true">→</span></Link>
          </Answer>
      </QuestionGroup>
    </div>

    <section className={styles.next} aria-labelledby="next-title">
      <div className={styles.wrap}>
        <h2 id="next-title">see what happens next.</h2>
        <p>From your first photo to the listing you approve.</p>
        <Link className={styles.pill} href="/how-it-works">See how it works <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  </main>;
}
