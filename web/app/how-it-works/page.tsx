import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountAccess } from '../../components/marketing/home';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'How It Works · secondhand',
  description: 'See how to prepare an item for resale, review your listings, and find used items within your budget.',
};

const sellingSteps = [
  {
    id: 'selling', number: '01', title: 'Start with photos.',
    body: 'Add the item and any detail that could change its price, like a label or a flaw.',
    image: 'capture', alt: 'The app camera frames the whole front of a gold Marquette tee.',
  },
  {
    id: 'price', number: '02', title: 'Review the price.',
    body: 'Check similar items that sold and compare what you’d keep on each site.',
    image: 'plan', alt: 'Price planning for the gold Marquette tee, with sold-price evidence and estimated proceeds.',
    href: '/data-use', link: 'Where the prices come from',
  },
  {
    id: 'review', number: '03', title: 'Choose what goes live.',
    body: 'Review the photos, price and listing for each site before you approve it.',
    image: 'preview', alt: 'The gold Marquette tee is ready for review, with separate eBay and Depop listing previews.',
  },
  {
    id: 'after-the-sale', number: '04', title: 'Keep the next step in view.',
    body: 'When an item sells, check the shipping details and what needs to happen next.',
    image: 'ship', alt: 'Shipping details for a sold Marquette tee, including the label and next action.',
  },
];

function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? '↓' : '→'}</span>;
}

function Phone({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  return <figure className={styles.phone}>
    <img src={`/marketing/app/${name}.png`} alt={alt} width={880} height={1840} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    <figcaption>App preview · Sample data</figcaption>
  </figure>;
}

export default function HowItWorksPage() {
  return <main id="main" className={styles.page}>
    <header className={`${styles.wrap} ${styles.intro}`}>
      <div>
        <p className={styles.label}>How It Works</p>
        <h1>From the first photo to the next decision.</h1>
        <p className={styles.lead}>See how to sell something you own or find what you want used.</p>
      </div>
      <nav className={styles.paths} aria-label="Choose a walkthrough">
        <a href="#selling"><span>Selling<small>From photos to a listing you approve.</small></span><Arrow down /></a>
        <a href="#buying"><span>Buying<small>Find what fits your budget and your plans.</small></span><Arrow down /></a>
      </nav>
    </header>

    <div className={styles.selling}>
      {sellingSteps.map((step, index) => <section id={step.id} key={step.id} className={`${styles.step} ${index % 2 ? styles.reverse : ''}`} aria-labelledby={`${step.id}-title`}>
        <div className={`${styles.wrap} ${styles.stepGrid}`}>
          <div className={styles.copy}>
            <p className={styles.label}><span>Selling</span><span className={styles.stepNumber}>{step.number} / 04</span></p>
            <h2 id={`${step.id}-title`}>{step.title}</h2>
            <p className={styles.body}>{step.body}</p>
            {step.href && <Link className={styles.textLink} href={step.href}>{step.link} <Arrow /></Link>}
          </div>
          <Phone name={step.image} alt={step.alt} eager={index === 0} />
        </div>
      </section>)}
    </div>

    <section id="buying" className={styles.buying} aria-labelledby="buying-title">
      <div className={`${styles.wrap} ${styles.buyingGrid}`}>
        <div className={styles.copy}>
          <p className={styles.label}>Buying</p>
          <h2 id="buying-title">Tell us what you’re looking for.</h2>
          <p className={styles.body}>Set your budget, fit and whether you can pick it up.</p>
          <dl className={styles.buyingDetails}>
            <div><dt>Set your limits</dt><dd>Choose a price range, how you want to get it and the fit you prefer.</dd></div>
            <div><dt>Check the listing</dt><dd>Compare the item and delivery cost, then open its marketplace.</dd></div>
          </dl>
          <Link className={styles.textLink} href="/features">How matching works <Arrow /></Link>
        </div>
        <Phone name="watch" alt="A watch for a Brewers jersey with a delivered-price range, pickup distance, color and fit preferences." />
      </div>
    </section>

    <section className={`${styles.wrap} ${styles.deeper}`} aria-labelledby="deeper-title">
      <h2 id="deeper-title">Want to see what’s behind it?</h2>
      <div><Link className={styles.textLink} href="/features">Explore Features <Arrow /></Link><Link className={styles.textLink} href="/data-use">Explore Data Use <Arrow /></Link></div>
    </section>
    <section className={`${styles.wrap} ${styles.signup}`} aria-labelledby="signup-title">
      <div><p className={styles.label}>Sign Up</p><h2 id="signup-title">Start with one thing.</h2></div>
      <AccountAccess label="Create an account" />
    </section>
  </main>;
}
