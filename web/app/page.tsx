import { Conversation } from '../components/conversation';
export default function Home() {
  return <main id="main"><section className="hero" aria-labelledby="home-title"><div className="hero-intro" data-field><h1 id="home-title">Find it secondhand.</h1></div><Conversation home /></section><div className="home-sections"><section><h2>Search in one place.</h2><p>Find secondhand items across marketplaces and compare them with official retail.</p></section><section><h2>See what it’s worth.</h2><p>Compare prices, see what sold, and follow the sources behind an answer.</p></section></div></main>;
}
