'use client';

import Link from 'next/link';
import { AccountAccess } from './chrome';
import { useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from '@ui-sdk/react/accordion';
import { Carousel, CarouselContent, CarouselIndicator, CarouselIndicatorGroup, CarouselItem, CarouselNext, CarouselPlayToggle, CarouselPrevious, CarouselViewport } from '@ui-sdk/react/carousel';
import { log } from '../../lib/log';
import { wallPhotos } from './wall-photos';

const repository = 'https://github.com/benverhaalen/secondhand';
const docs = `${repository}/blob/main/product`;
export { AccountAccess } from './chrome';

function Platforms({ labeled = false }: { labeled?: boolean }) {
  const platforms = [['ebay', 'eBay'], ['depop', 'Depop'], ['poshmark', 'Poshmark'], ['mercari', 'Mercari'], ['facebook', 'Facebook Marketplace']];
  return <ul className={`marketing-platforms${labeled ? ' platforms-labeled' : ''}`} aria-label="Marketplace sources">{platforms.map(([file, name]) => <li key={file}><img src={`/marketing/platforms/${file}.png`} width="32" height="32" alt={name} />{labeled && <span>{name}</span>}</li>)}</ul>;
}

function Hero() {
  return <section className="marketing-hero" aria-labelledby="home-title">
    <div className="marketing-wall" aria-hidden="true">{Array.from({ length: 9 }, (_, col) => <div className={`wall-column wall-column-${col}`} key={col}>{wallPhotos.slice(col * 6, col * 6 + 6).map(photo => <img key={photo.src} src={photo.src} alt="" width="168" height="168" fetchPriority="low" />)}</div>)}</div>
    <div className="marketing-hero-copy">
      <h1 id="home-title"><span className="hero-kicker">Your second hand, for everything</span>{' '}<span className="hero-wordmark">secondhand</span></h1>
      <p>Check sold prices, prepare listings, and find used items across resale sites in one place.</p>
      <a className="marketing-pill" href="#how-it-works">See how it works</a>
      <Platforms />
    </div>
  </section>;
}

function Phone({ screen, alt, priority = false }: { screen: string; alt: string; priority?: boolean }) {
  return <div className="marketing-phone"><img src={`/marketing/app/${screen}.png`} alt={alt} width="880" height="1840" loading={priority ? 'eager' : 'lazy'} /></div>;
}

function HowItWorks() {
  return <section className="marketing-scene how-scene" id="how-it-works" aria-labelledby="how-title" data-field>
    <div className="marketing-wrap marketing-split how-split">
      <div className="marketing-copy"><p className="section-label">How It Works</p><h2 id="how-title">Get your clothes ready to resell from as little as one photo</h2><p className="section-body">See what similar pieces sold for, compare what you’d keep, and review your listings before you post.</p><a className="marketing-text-link" href={`${docs}/app-flows.md`}>See the selling steps <ExternalArrow /></a></div>
      <figure className="selling-journey">
        <div className="phone-pair"><div><Phone screen="capture" alt="Sample app screen. Photographing the real Marquette tee." /><p className="phone-caption">Start with your photo</p></div><span className="journey-arrow" aria-hidden="true">→</span><div><Phone screen="preview" alt="Sample app screen. Review the same Marquette tee before posting." /><p className="phone-caption">Review what goes live</p></div></div>
        <figcaption><Platforms /><span>One item. Marketplace previews.<br /><span className="sample-note">App screens with sample data.</span></span></figcaption>
      </figure>
    </div>
  </section>;
}

const features = [
  { screen: 'plan', title: 'Compare what you’d keep.', body: 'Check sold prices and compare what is left after each site’s fees before choosing a price.', alt: 'Sample app plan for the Marquette tee, showing a price and marketplace payouts.' },
  { screen: 'preview', title: 'Review a listing for each site.', body: 'Check the photos, title and price together. The next step stays yours to approve.', alt: 'Sample app listing preview for the Marquette tee across two marketplaces.' },
  { screen: 'watch', title: 'Find a match within your limits.', body: 'Set your size and budget, then compare the matches with shipping included when it is known.', alt: 'Sample app Watch screen showing a search request and its limits.' },
  { screen: 'ship', title: 'Know what needs you next.', body: 'Keep the next action beside the item, from reviewing a buyer’s offer to preparing a shipment.', alt: 'Sample app shipping screen showing the item and its next action.' },
];

function Features() {
  const [page, setPage] = useState(1);
  const feature = features[page - 1];
  return <section className="marketing-scene features-scene" id="features" aria-labelledby="features-title">
    <Carousel className="marketing-wrap feature-carousel" aria-label="What you can do with secondhand" defaultPlaying onPageChange={next => { setPage(next); log.input('home', 'feature-page', { value: next }); }}>
      <CarouselViewport className="feature-viewport"><CarouselContent className="feature-track">{features.map(item => <CarouselItem className="feature-slide" key={item.screen} aria-label={item.title}><div className="feature-phone-ground" data-field><Phone screen={item.screen} alt={item.alt} /></div></CarouselItem>)}</CarouselContent></CarouselViewport>
      <div className="marketing-copy feature-copy"><p className="section-label">Features</p><h2 id="features-title">AI does the prep. You decide what goes live.</h2><p className="section-body feature-summary">It reads item details from photos, drafts listings for different sites, and helps buyers find what fits.</p><div className="feature-explanation"><h3>{feature.title}</h3><p className="section-body">{feature.body}</p></div><a className="marketing-text-link" href={`${docs}/features-proof.md`}>Explore features <ExternalArrow /></a></div>
      <div className="carousel-controls"><CarouselPrevious className="carousel-arrow" aria-label="Previous feature">←</CarouselPrevious><CarouselIndicatorGroup className="carousel-dots" aria-label="Choose a feature">{features.map((item, index) => <CarouselIndicator key={item.screen} page={index + 1} aria-label={item.title} />)}</CarouselIndicatorGroup><CarouselNext className="carousel-arrow" aria-label="Next feature">→</CarouselNext><CarouselPlayToggle className="carousel-play">{state => state.playing ? 'Pause' : 'Play'}</CarouselPlayToggle></div>
      <p className="feature-sample-note">App screens with sample data.</p>
    </Carousel>
  </section>;
}

function DataPipeline() {
  return <figure className="data-pipeline" aria-labelledby="pipeline-title" data-field>
    <figcaption id="pipeline-title">From source record to price evidence</figcaption>
    <div className="pipeline-flow">
      <div className="pipeline-step"><h3>Incoming records</h3><p>Listings<br />Completed sales</p></div>
      <span className="pipeline-arrow" aria-hidden="true">→</span>
      <div className="pipeline-step"><h3>Checked in Databricks</h3><p>Lakeflow checks incoming records.<br />Unity Catalog tracks usage rules.</p><a href={`${repository}/tree/main/jobs`}>Inspect the pipeline <ExternalArrow /></a></div>
      <span className="pipeline-arrow" aria-hidden="true">→</span>
      <div className="pipeline-step"><h3>Price evidence</h3><p>Eligible sales<br />Traceable sources</p></div>
    </div>
    <div className="pipeline-branches"><span>Duplicates removed</span><span>Display-only records kept out of pricing</span></div>
  </figure>;
}

function PricingProof() {
  return <figure className="pricing-proof" aria-labelledby="pricing-title">
    <div className="proof-heading"><figcaption id="pricing-title"><span className="proof-number">84%</span> fewer big pricing misses</figcaption><a className="marketing-text-link" href={`${repository}/blob/main/scripts/bench/out/backtest-stockx.json`}>Method and full results <ExternalArrow /></a></div>
    <div className="proof-bars" role="img" aria-label="On the same historical sneaker cases, the 90-day median missed by over 20 percent on 9.8 percent of prices. The research model did so on 1.5 percent."><div className="proof-row"><span>90-day median</span><div className="proof-track"><span className="proof-bar baseline-bar" /></div><span>9.8%</span></div><div className="proof-row"><span>Research model</span><div className="proof-track"><span className="proof-bar model-bar" /></div><span>1.5%</span></div></div>
    <div className="proof-axis" aria-hidden="true"><span>0%</span><span>5%</span><span>10%</span></div>
    <p>Historical sneaker test. A big miss is a price more than 20% from the actual sale. Compared on the same cases. Research result, not live app performance.</p>
  </figure>;
}

function DataUse() {
  return <section className="marketing-scene data-scene" id="data-use" aria-labelledby="data-title"><div className="marketing-wrap data-layout"><div className="marketing-copy"><p className="section-label">Data Use</p><h2 id="data-title">From messy listings to a price you can check.</h2><p className="section-body">We use Databricks to check incoming records, record how they can be used, and show the sales behind an estimate.</p><a className="marketing-text-link" href={`${docs}/proof-without-sales.md`}>Explore Data Use <ExternalArrow /></a></div><div className="data-figures"><DataPipeline /><PricingProof /></div></div></section>;
}

function FAQ() {
  const questions = [
    { id: 'approval', question: 'Who can post from my account?', answer: 'You review the listing before approving it. The app prepares the photos, title and price for each site so you can check what will be sent.', source: `${docs}/pitch-constitution.md` },
    { id: 'two-sales', question: 'What if the same item sells on two sites?', answer: 'A second buyer can pay before the other listings are removed. The workflow is designed to flag a second payment so you can review both orders.', source: `${repository}/blob/main/scripts/bench/out/bench-sites-4.json` },
  ];
  return <section className="marketing-scene faq-scene" id="faq" aria-labelledby="faq-title"><div className="marketing-wrap marketing-split"><div className="marketing-copy"><p className="section-label">FAQ</p><h2 id="faq-title">What should you know before you start?</h2></div><div className="faq-content"><Accordion className="marketing-faq">{questions.map(item => <AccordionItem key={item.id} value={item.id} className="faq-item"><AccordionHeader><AccordionTrigger className="faq-trigger">{item.question}<span aria-hidden="true">+</span></AccordionTrigger></AccordionHeader><AccordionPanel className="faq-panel"><p>{item.answer}</p><a href={item.source}>See how it works <ExternalArrow /></a></AccordionPanel></AccordionItem>)}</Accordion><a className="marketing-text-link" href={`${docs}/pitch-constitution.md`}>Read about control and trust <ExternalArrow /></a></div></div></section>;
}

export function MarketingHome() {
  return <main id="main" className="marketing-home"><div id="top" /><Hero /><HowItWorks /><Features /><DataUse /><FAQ /><section className="marketing-scene signup-scene" id="access" aria-labelledby="signup-title"><div className="marketing-wrap signup-layout"><div className="marketing-copy"><p className="section-label">Sign Up</p><h2 id="signup-title">Start with one thing.</h2></div><AccountAccess label="Create an account" /></div></section></main>;
}
