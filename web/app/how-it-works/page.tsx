import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { AppPreviewImage } from '../../components/marketing/app-preview-image';
import { AccountAccess } from '../../components/marketing/chrome';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'How It Works · secondhand',
  description: 'See how to prepare an item for resale, review your listings, and find used items within your budget.',
};

const sellingSteps = [
  {
    id: 'selling', number: '01', title: 'Start with photos',
    body: 'Add the item and any detail that could change its price, like a label or a flaw.',
    image: 'capture', alt: 'App review after adding one photo of the sample Carhartt jacket.',
  },
  {
    id: 'price', number: '02', title: 'Review the price',
    body: 'Check similar sales and choose an asking price.',
    image: 'plan', alt: 'The asking-price screen for the same sample jacket.',
    href: '/data-use', link: 'Where the prices come from',
  },
  {
    id: 'review', number: '03', title: 'Review the listing',
    body: 'Check the photos, price and item details. Copy the listing details when you’re ready to finish on the marketplace you choose.',
    image: 'preview', alt: 'The same sample jacket in the listing preview.',
  },
];

function Arrow({ down = false }: { down?: boolean }) {
  return <Icon name={down ? "arrow-down-01" : "arrow-right-01"} size={16} />;
}

function Phone({ name, alt, eager = false, caption = 'App preview · Sample data' }: { name: string; alt: string; eager?: boolean; caption?: string }) {
  return <figure className={styles.phone}>
    <AppPreviewImage name={name} alt={alt} sizes="(max-width: 359px) 240px, 280px" eager={eager} />
    <figcaption>{caption}</figcaption>
  </figure>;
}

export default function HowItWorksPage() {
  return <main id="main" className={styles.page}>
    <header className="marketing-atmosphere" data-tone="process"><div className={`${styles.wrap} ${styles.intro}`}>
      <div>
        <p className={styles.label}>How It Works</p>
        <h1 className="marketing-page-title">Get your clothes ready to resell from as little as one photo</h1>
        <p className={styles.lead}>Check sold prices and choose what to list. If you’re shopping, start with what you want and how much you can spend.</p>
      </div>
      <nav className={styles.paths} aria-label="Choose a walkthrough">
        <a href="#selling"><span>Selling<small>From photos to a listing you review.</small></span><Arrow down /></a>
        <a href="#buying"><span>Buying<small>Find what fits your budget and your plans.</small></span><Arrow down /></a>
      </nav>
    </div></header>

    <div>
      {sellingSteps.map((step, index) => <section id={step.id} key={step.id} className={`${styles.step} ${index % 2 ? styles.reverse : ''}`} aria-labelledby={`${step.id}-title`}>
        <div className={`${styles.wrap} ${styles.stepGrid}`}>
          <div className={styles.copy}>
            <p className={styles.label}><span>Selling</span><span className={styles.stepNumber}>{step.number} / 03</span></p>
            <h2 id={`${step.id}-title`}>{step.title}</h2>
            <p className={styles.body}>{step.body}</p>
            {step.href && <Link className={styles.textLink} href={step.href}>{step.link} <Arrow /></Link>}
            {index === 0 && <nav className={styles.progression} aria-label="Selling steps"><a href="#selling">Photo</a><Arrow /><a href="#price">Price</a><Arrow /><a href="#review">Review</a></nav>}
          </div>
          {index === 0 ? <div className={styles.phonePair}>
            <Phone name={step.image} alt={step.alt} eager caption="Add your item" />
            <div className={styles.pairedPreview}><Phone name="preview" alt={sellingSteps[2].alt} caption="Ready for review" /></div>
            <p className={styles.sampleNote}>App preview · Sample data</p>
          </div> : <Phone name={step.image} alt={step.alt} />}
        </div>
      </section>)}
    </div>

    <section id="after-the-sale" className={`${styles.step} ${styles.reverse}`} aria-labelledby="shipping-title">
      <div className={`${styles.wrap} ${styles.stepGrid}`}>
        <div className={styles.copy}>
          <p className={styles.label}>After a sale</p>
          <h2 id="shipping-title">Check what the sale paid out</h2>
          <p className={styles.body}>See what the buyer paid and what you kept. Continue on the marketplace for shipping.</p>
        </div>
        <Phone name="ship" alt="Sale details and a marketplace handoff for a sample e-reader." caption="Separate sale example · Sample data" />
      </div>
    </section>

    <section id="buying" className={`${styles.buying} marketing-atmosphere`} data-tone="process" aria-labelledby="buying-title">
      <div className={`${styles.wrap} ${styles.buyingGrid}`}>
        <div className={styles.copy}>
          <p className={styles.label}>Buying</p>
          <h2 id="buying-title">Tell us what you’re looking for</h2>
          <p className={styles.body}>Set your budget, size and preferences.</p>
          <dl className={styles.buyingDetails}>
            <div><dt>Check the listing</dt><dd>Compare the item and delivery cost, then open its marketplace.</dd></div>
          </dl>
          <Link className={styles.textLink} href="/features">How matching works <Arrow /></Link>
        </div>
        <Phone name="watch" alt="A saved Brewers jersey request with a target price, size and color." />
      </div>
    </section>

    <section className={`${styles.wrap} ${styles.deeper}`} aria-labelledby="deeper-title">
      <h2 id="deeper-title">Want to see what’s behind it?</h2>
      <div><Link className={styles.textLink} href="/features">Explore Features <Arrow /></Link><Link className={styles.textLink} href="/data-use">Explore Data Use <Arrow /></Link></div>
    </section>
    <section className={`${styles.wrap} ${styles.signup}`} aria-labelledby="signup-title">
      <div><p className={styles.label}>Sign Up</p><h2 id="signup-title">Start with one thing</h2></div>
      <AccountAccess label="Create an account" />
    </section>
  </main>;
}
