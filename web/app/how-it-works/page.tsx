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
    body: 'Start with a photo, then check the brand, size and condition. A clear photo of the label or a flaw can fill in details the first photo missed.',
    image: 'capture', alt: 'App review after adding one photo of a Carhartt jacket.',
  },
  {
    id: 'price', number: '02', title: 'Review the price',
    body: 'Compare the estimate with similar sales and check what you would keep after marketplace fees. Choose an asking price that fits your item’s condition.',
    image: 'plan', alt: 'The asking-price screen for the same jacket.',
    href: '/data-use', link: 'Where the prices come from',
  },
  {
    id: 'review', number: '03', title: 'Review the listing',
    body: 'Review the photos, price and description. When they look right, copy the listing details and finish posting on your chosen marketplace.',
    image: 'preview', alt: 'The same jacket in the listing preview.',
  },
];

function Arrow({ down = false }: { down?: boolean }) {
  return <Icon name={down ? "arrow-down-01" : "arrow-right-01"} size={16} />;
}

function Phone({ name, alt, eager = false, caption }: { name: string; alt: string; eager?: boolean; caption?: string }) {
  return <figure className={styles.phone}>
    <AppPreviewImage name={name} alt={alt} sizes="(max-width: 359px) 240px, 280px" eager={eager} />
    {caption && <figcaption>{caption}</figcaption>}
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
        <a href="#buying"><span>Buying<small>Find an item in your size and budget.</small></span><Arrow down /></a>
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
          </div> : <Phone name={step.image} alt={step.alt} />}
        </div>
      </section>)}
    </div>

    <section id="after-the-sale" className={`${styles.step} ${styles.reverse}`} aria-labelledby="shipping-title">
      <div className={`${styles.wrap} ${styles.stepGrid}`}>
        <div className={styles.copy}>
          <p className={styles.label}>After a sale</p>
          <h2 id="shipping-title">See what you kept after the sale</h2>
          <p className={styles.body}>Check the sale amount, fees and what you kept. Open the marketplace to arrange shipping.</p>
        </div>
        <Phone name="ship" alt="Sale details and a marketplace handoff for an e-reader." />
      </div>
    </section>

    <section id="buying" className={`${styles.buying} marketing-atmosphere`} data-tone="process" aria-labelledby="buying-title">
      <div className={`${styles.wrap} ${styles.buyingGrid}`}>
        <div className={styles.copy}>
          <p className={styles.label}>Buying</p>
          <h2 id="buying-title">Tell us what you’re looking for</h2>
          <p className={styles.body}>Save the item you want, along with your size, budget and preferences.</p>
          <dl className={styles.buyingDetails}>
            <div><dt>Check the listing</dt><dd>Check the size, condition and total cost, including delivery.</dd></div><div><dt>Buy on the marketplace</dt><dd>Open the listing to confirm availability, shipping and payment details before buying.</dd></div>
          </dl>
          <Link className={styles.textLink} href="/features">How matching works <Arrow /></Link>
        </div>
        <Phone name="watch" alt="A saved Brewers jersey request with a target price, size and color." />
      </div>
    </section>

    <section className={`${styles.wrap} ${styles.deeper}`} aria-labelledby="deeper-title">
      <h2 id="deeper-title">How does secondhand make these decisions?</h2>
      <div><Link className={styles.textLink} href="/features">Explore Features <Arrow /></Link><Link className={styles.textLink} href="/data-use">Explore Data Use <Arrow /></Link></div>
    </section>
    <section className={`${styles.wrap} ${styles.signup}`} aria-labelledby="signup-title">
      <div><p className={styles.label}>Sign Up</p><h2 id="signup-title">Start with one thing</h2></div>
      <AccountAccess label="Create an account" />
    </section>
  </main>;
}
