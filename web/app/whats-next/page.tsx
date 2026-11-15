import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import itemPhoto from './carhartt-jacket.jpg';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'What’s Next · secondhand',
  description: 'Broader appraisal, a selling process measured on real items, and the economics we need to prove.',
};

const nextSteps = [
  {
    name: 'Broader appraisal',
    question: 'Where does the estimate hold up?',
    body: 'Test more kinds of items and publish the results by category. When there are too few comparable sales, ask for the detail that would help or point someone to a specialist.',
  },
  {
    name: 'The whole selling process',
    question: 'How much work does it actually save?',
    body: 'Follow real items from the first photo to a confirmed result. Measure the time spent, the edits sellers make and what needs their attention when a marketplace action fails.',
  },
  {
    name: 'Affordable monitoring',
    question: 'When is a faster check worth it?',
    body: 'Measure what it costs to watch active listings. Check more often when a change matters, and use the results to decide which marketplaces and account limits we can support.',
  },
];

const businessOptions = [
  { name: 'Buying referrals', body: 'A marketplace could pay us when someone buys through a link. Referral income must never change which listing we recommend.' },
  { name: 'Optional photo tools', body: 'Paid photo tools could cover their own costs while keeping basic listing preparation free.' },
  { name: 'A plan for frequent sellers', body: 'A paid plan could support people with more active listings and higher monitoring costs.' },
];

function Arrow({ down = false }: { down?: boolean }) {
  return <Icon name={down ? "arrow-down-01" : "arrow-right-01"} size={16} />;
}

export default function WhatsNextPage() {
  return <main id="main" className={styles.page}>
    <header className="marketing-atmosphere" data-tone="next">
      <div className={`${styles.wrap} ${styles.intro}`}>
        <div className={styles.introCopy}>
          <p className={styles.label}>What’s Next</p>
          <h1 className="marketing-page-title">What else could a photo tell you?</h1>
          <p className={styles.lead}>We want you to be able to photograph a garage-sale find and get a price estimate before you buy it.</p>
          <a className={`marketing-pill ${styles.heroAction}`} href="#next-steps">What we need to prove <Arrow down /></a>
        </div>
        <div className={styles.appraisalGroup}>
          <figure className={styles.appraisal}>
            <div className={styles.photoGround}>
              <Image className={styles.itemPhoto} src={itemPhoto} alt="A sample brown Carhartt jacket laid flat." sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 50vw, 480px" preload />
            </div>
            <figcaption>Sample Carhartt jacket</figcaption>
          </figure>
          <div className={styles.photoQuestions}>
            <p>What would help price this?</p>
            <ul><li>A readable label</li><li>Clear signs of wear</li><li>Comparable items that sold</li></ul>
          </div>
        </div>
      </div>
    </header>

    <section id="next-steps" className={`${styles.wrap} ${styles.nextSteps}`} aria-labelledby="next-steps-title">
      <div className={styles.sectionIntro}>
        <p className={styles.label}>The next tests</p>
        <h2 id="next-steps-title">More kinds of items. Evidence for each</h2>
        <p className={styles.body}>Appraise anything is the ambition. We need to show where estimates hold up, and when to ask for more information.</p>
      </div>
      <div className={styles.steps}>
        {nextSteps.map(step => <article className={styles.step} key={step.name}>
          <p className={styles.stepName}>{step.name}</p>
          <h3>{step.question}</h3><p className={styles.body}>{step.body}</p>
        </article>)}
      </div>
    </section>

    <section className={styles.business} aria-labelledby="business-title">
      <div className={styles.wrap}>
        <div className={styles.businessIntro}>
          <div><p className={styles.label}>The business we’re exploring</p><h2 id="business-title">How the core product could stay free</h2></div>
          <p className={styles.body}>Someone clearing out a closet may only sell a few things. We want the core product to work for them without a monthly subscription.</p>
        </div>
        <div className={styles.options}>
          {businessOptions.map(option => <article key={option.name}><h3>{option.name}</h3><p className={styles.body}>{option.body}</p></article>)}
        </div>
        <div className={styles.cost}>
          <div className={styles.costAmount}><p className={styles.amount}>2 to 8¢</p><p>Modeled basic listing cost per item</p></div>
          <div className={styles.costContext}>
            <p>We modeled this cost using provider prices. Monitoring costs extra. Customer pricing is undecided.</p>
            <a className={styles.textLink} href="https://github.com/benverhaalen/secondhand/blob/main/product/numbers.md#what-it-costs-us">See the cost assumptions <Arrow /></a>
          </div>
        </div>
        <p className={styles.businessConclusion}>We’ll measure costs and referral revenue before making a pricing promise.</p>
        <a className={styles.textLink} href="https://github.com/benverhaalen/secondhand/blob/main/product/business.md">Read the business proposal <Arrow /></a>
      </div>
    </section>

    <section className={`${styles.wrap} ${styles.deeper}`} aria-labelledby="deeper-title">
      <h2 id="deeper-title">See what these plans build on</h2>
      <div><Link className={styles.textLink} href="/features">Explore Features <Arrow /></Link><Link className={styles.textLink} href="/data-use">Read about Data Use <Arrow /></Link></div>
    </section>
  </main>;
}
