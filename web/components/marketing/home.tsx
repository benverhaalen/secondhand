'use client';

import Link from 'next/link';
import { Icon } from '../icon';
import { AppPreviewImage } from './app-preview-image';
import { AccountAccess } from './chrome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from '@ui-sdk/react/accordion';
import { log } from '../../lib/log';
import { wallPhotos } from './wall-photos';

const emptyTile = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const repository = 'https://github.com/benverhaalen/secondhand';
export { AccountAccess } from './chrome';

function ExternalArrow() {
  return <svg className="external-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

function Platforms() {
  const platforms = [['ebay', 'eBay'], ['depop', 'Depop'], ['poshmark', 'Poshmark'], ['mercari', 'Mercari'], ['facebook', 'Facebook Marketplace']];
  return <ul className="marketing-platforms" aria-label="Marketplace sources">{platforms.map(([file, name]) => <li key={file}><img src={`/marketing/platforms/${file}.png`} width="32" height="32" alt={name} /></li>)}</ul>;
}

function Hero() {
  return <section className="marketing-hero" aria-labelledby="home-title">
    <div className="marketing-wall" aria-hidden="true">
      {Array.from({ length: 9 }, (_, column) => <div className="wall-column" key={column}>
        {wallPhotos.slice(column * 6, column * 6 + 6).map(photo => <picture key={photo.src}>
          {(column < 3 || column > 5) && <source media="(max-width: 430px)" srcSet={emptyTile} />}
          <img src={photo.src} alt="" width={168} height={168} fetchPriority="low" />
        </picture>)}
      </div>)}
    </div>
    <div className="marketing-hero-copy">
      <h1 id="home-title"><span className="hero-kicker">Your second hand for all things:</span>{' '}<span className="hero-wordmark">secondhand</span></h1>
      <p>Check sold prices, prepare listings, and find used items across resale sites in one place.</p>
      <a className="marketing-pill" href="#how-it-works">See how it works</a>
      <Platforms />
    </div>
  </section>;
}

function Phone({ screen, alt, pair = false }: { screen: string; alt: string; pair?: boolean }) {
  return <div className="marketing-phone"><AppPreviewImage name={screen} alt={alt} sizes={pair ? '(max-width: 760px) calc((100vw - 60px) / 2), 234px' : '(max-width: 760px) 230px, 264px'} /></div>;
}

function HowItWorks() {
  return <section className="marketing-scene how-scene marketing-atmosphere" data-tone="process" id="how-it-works" aria-labelledby="how-title" data-field>
    <div className="marketing-wrap marketing-split how-split">
      <div className="marketing-copy"><p className="section-label">How It Works</p><h2 id="how-title">Get your clothes ready to resell from as little as one photo</h2><p className="section-body">Check sold prices, review the listing and choose where to post.</p><Link className="marketing-text-link" href="/how-it-works">See the selling steps <Icon name="arrow-right-01" size={16} /></Link></div>
      <figure className="selling-journey">
        <div className="phone-pair"><div><Phone pair screen="capture" alt="App review after adding one photo of the sample Carhartt jacket." /><p className="phone-caption">Start with your photo</p></div><Icon name="arrow-right-01" size={20} className="journey-arrow" /><div><Phone pair screen="preview" alt="Listing review for the same sample jacket." /><p className="phone-caption">Review the listings</p></div></div>
        <figcaption>App screens with sample data</figcaption>
      </figure>
    </div>
  </section>;
}

const features = [
  { screen: 'plan', title: 'Choose an asking price', body: 'Check what similar items sold for before you set your price.', alt: 'Asking-price options for a sample Carhartt jacket.' },
  { screen: 'preview', title: 'Review the listing before you post', body: 'Check the photos, title and price. Copy the details when you’re ready to post on a marketplace.', alt: 'App listing preview for a sample Carhartt jacket.' },
  { screen: 'watch', title: 'Find a match within your limits', body: 'Set your size and budget, then compare the matches with shipping included when it is known.', alt: 'Sample app Watch screen showing a search request and its limits.' },
  { screen: 'ship', title: 'See what a sale paid out', body: 'Check the sale amount, marketplace fees and what you kept.', alt: 'App sale details for a sample e-reader.' },
];

function Features() {
  const viewport = useRef<HTMLDivElement>(null);
  const requested = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const feature = features[page];

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    update();
    setPlaying(!preference.matches);
    preference.addEventListener('change', update);
    const visibility = () => setVisible(document.visibilityState === 'visible');
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= .5), { threshold: .5 });
    if (viewport.current) {
      setPage(Math.round(viewport.current.scrollLeft / viewport.current.clientWidth));
      observer.observe(viewport.current);
    }
    return () => {
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
    };
  }, []);

  const goTo = useCallback((next: number, animate: boolean) => {
    const element = viewport.current;
    if (!element) return;
    const target = (next + features.length) % features.length;
    const previous = Math.round(element.scrollLeft / element.clientWidth);
    const left = target * element.clientWidth;
    requested.current = Math.abs(element.scrollLeft - left) > 1 ? target : null;
    setPage(target);
    element.scrollTo({ left, behavior: animate && !reducedMotion && Math.abs(target - previous) === 1 ? 'smooth' : 'instant' });
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing || !inView || hovered || !visible) return;
    const timer = window.setTimeout(() => goTo(page + 1, true), 5000);
    return () => window.clearTimeout(timer);
  }, [playing, inView, hovered, visible, page, goTo]);

  function select(next: number, animate: boolean) {
    setPlaying(false);
    goTo(next, animate);
    log.input('home', 'feature-page', { value: (next + features.length) % features.length + 1 });
  }

  return <section className="marketing-scene features-scene" id="features" aria-labelledby="features-title">
    <div className="marketing-wrap feature-carousel" role="region" aria-roledescription="carousel" aria-label="What you can do with secondhand"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={event => { if (!(event.target as HTMLElement).closest('.carousel-play')) setPlaying(false); }}>
      <div className="feature-viewport" ref={viewport} tabIndex={0} aria-label="Feature screenshots"
        onPointerDown={() => { requested.current = null; setPlaying(false); }}
        onWheel={event => { if (event.deltaX) { requested.current = null; setPlaying(false); } }}
        onKeyDown={event => {
          const active = requested.current ?? page;
          const next = event.key === 'ArrowRight' ? active + 1 : event.key === 'ArrowLeft' ? active - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? features.length - 1 : null;
          if (next !== null) { event.preventDefault(); select(next, false); }
        }}
        onScroll={event => {
          const element = event.currentTarget;
          if (requested.current !== null) {
            if (Math.abs(element.scrollLeft - requested.current * element.clientWidth) <= 1) requested.current = null;
            return;
          }
          setPage(Math.max(0, Math.min(features.length - 1, Math.round(element.scrollLeft / element.clientWidth))));
        }}>
        <div className="feature-track">{features.map((item, index) => <div className="feature-slide" key={item.screen} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${features.length}: ${item.title}`} aria-hidden={index !== page}><div className="feature-phone-ground marketing-atmosphere" data-tone="features"><Phone screen={item.screen} alt={item.alt} /></div></div>)}</div>
      </div>
      <div className="marketing-copy feature-copy"><p className="section-label">Features</p><h2 id="features-title">AI does the prep. You decide what goes live</h2><p className="section-body feature-summary">It reads item details from photos, helps you prepare a listing and looks for used items that fit.</p><div className="feature-explanation" aria-live={playing ? 'off' : 'polite'} aria-atomic="true"><h3>{feature.title}</h3><p className="section-body">{feature.body}</p></div><Link className="marketing-text-link" href="/features">Explore features <Icon name="arrow-right-01" size={16} /></Link></div>
      <div className="carousel-controls"><button className="carousel-arrow" type="button" aria-label="Previous feature" onClick={event => select((requested.current ?? page) - 1, event.detail > 0)}><Icon name="arrow-left-01" size={20} /></button><div className="carousel-dots" role="group" aria-label="Choose a feature">{features.map((item, index) => <button key={item.screen} type="button" aria-current={index === page ? 'true' : undefined} aria-label={item.title} onClick={event => select(index, event.detail > 0)} />)}</div><button className="carousel-arrow" type="button" aria-label="Next feature" onClick={event => select((requested.current ?? page) + 1, event.detail > 0)}><Icon name="arrow-right-01" size={20} /></button><button className="carousel-play" type="button" aria-label={playing ? 'Pause automatic feature changes' : 'Play automatic feature changes'} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button></div>
      <p className="feature-sample-note">App screens with sample data.</p>
    </div>
  </section>;
}

function DataPipeline() {
  return <figure className="data-pipeline" aria-labelledby="pipeline-title" data-field>
    <figcaption id="pipeline-title">From source record to price evidence</figcaption>
    <div className="pipeline-flow">
      <div className="pipeline-step"><h3>Incoming records</h3><p>Listings<br />Completed sales</p></div>
      <Icon name="arrow-right-01" size={20} className="pipeline-arrow" />
      <div className="pipeline-step"><h3>Checked in Databricks</h3><p>Lakeflow checks incoming records.<br />Unity Catalog tracks usage rules.</p><Link href="/data-use#pipeline">Inspect the pipeline <Icon name="arrow-right-01" size={16} /></Link></div>
      <Icon name="arrow-right-01" size={20} className="pipeline-arrow" />
      <div className="pipeline-step"><h3>Price evidence</h3><p>Eligible sales<br />Traceable sources</p></div>
    </div>
    <div className="pipeline-branches"><span>Invalid prices excluded</span><span>Display-only records kept out of pricing</span></div>
  </figure>;
}

function PricingProof() {
  return <figure className="pricing-proof" aria-labelledby="pricing-title">
    <div className="proof-heading"><figcaption id="pricing-title"><span className="proof-number">84%</span> fewer big pricing misses</figcaption><a className="marketing-text-link" href={`${repository}/blob/main/scripts/bench/out/backtest-stockx.json`}>Method and full results <ExternalArrow /></a></div>
    <div className="proof-bars" role="img" aria-label="On the same historical sneaker cases, the 90-day median missed by over 20 percent on 9.8 percent of prices. The research model did so on 1.5 percent."><div className="proof-row"><span>90-day median</span><div className="proof-track"><span className="proof-bar baseline-bar" /></div><span>9.8%</span></div><div className="proof-row"><span>Research model</span><div className="proof-track"><span className="proof-bar model-bar" /></div><span>1.5%</span></div></div>
    <div className="proof-axis" aria-hidden="true"><span>0%</span><span>5%</span><span>10%</span></div>
    <p>Development benchmark on past sneaker sales. A big miss is more than 20% from the sale price. See the separate comparison on unseen months in Data Use.</p>
  </figure>;
}

function DataUse() {
  return <section className="marketing-scene data-scene" id="data-use" aria-labelledby="data-title"><div className="marketing-wrap data-layout"><div className="marketing-copy"><p className="section-label">Data Use</p><h2 id="data-title">From messy listings to a price you can check</h2><p className="section-body">We use Databricks to check incoming records, record how they can be used, and show the sales behind an estimate.</p><Link className="marketing-text-link" href="/data-use">Explore Data Use <Icon name="arrow-right-01" size={16} /></Link></div><div className="data-figures"><DataPipeline /><PricingProof /></div></div></section>;
}

function FAQ() {
  const questions = [
    { id: 'approval', question: 'Who can post from my account?', answer: 'You review the listing in secondhand, then finish posting it on the marketplace.', href: '/faq#who-can-post', link: 'Read the approval rules' },
    { id: 'two-sales', question: 'What if the same item sells on two sites?', answer: 'A second buyer can pay before the other listings are removed. The workflow is designed to flag a second payment so you can review both orders.', href: '/faq#two-sites', link: 'Read about duplicate sales' },
  ];
  return <section className="marketing-scene faq-scene" id="faq" aria-labelledby="faq-title"><div className="marketing-wrap marketing-split"><div className="marketing-copy"><p className="section-label">FAQ</p><h2 id="faq-title">What should you know before you start?</h2></div><div className="faq-content"><Accordion className="marketing-faq">{questions.map(item => <AccordionItem key={item.id} value={item.id} className="faq-item"><AccordionHeader><AccordionTrigger className="faq-trigger">{item.question}<Icon name="add-01" size={20} /></AccordionTrigger></AccordionHeader><AccordionPanel className="faq-panel"><p>{item.answer}</p><Link href={item.href}>{item.link} <Icon name="arrow-right-01" size={16} /></Link></AccordionPanel></AccordionItem>)}</Accordion><Link className="marketing-text-link" href="/faq">All questions <Icon name="arrow-right-01" size={16} /></Link></div></div></section>;
}

export function MarketingHome() {
  return <main id="main" className="marketing-home"><div id="top" /><Hero /><HowItWorks /><Features /><DataUse /><FAQ /><section className="marketing-scene signup-scene" id="access" aria-labelledby="signup-title"><div className="marketing-wrap signup-layout"><div className="marketing-copy"><p className="section-label">Sign Up</p><h2 id="signup-title">Start with one thing</h2></div><AccountAccess label="Create an account" /></div></section></main>;
}
