'use client';
// Scroll-driven figures for /engine. Each figure is complete as rendered; this only replays it step by step,
// so no script and Reduce Motion both leave the finished diagram.
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

type Select = (selector: string) => Element[];
const n = (q: Select, name: string) => q(`[data-n="${name}"]`);
const num = (el: Element, key: string) => Number((el as SVGElement).dataset[key] ?? 0);
const DRAW = { strokeDashoffset: 1 };
const MID = { transformOrigin: '50% 50%' };

const acts: Record<string, (q: Select, tl: gsap.core.Timeline) => void> = {
  sell(q, tl) {
    tl.from(n(q, 'photo'), { opacity: 0, scale: .94, ...MID })
      .fromTo(n(q, 'scan'), { opacity: 1, y: 0 }, { y: 174, duration: .9, ease: 'none', immediateRender: false })
      .to(n(q, 'scan'), { opacity: 0, duration: .15 }).addLabel('s0')
      .from(n(q, 'region'), { opacity: 0, stagger: .12 })
      .from(n(q, 'leader'), { ...DRAW, stagger: .12 }, '<.1')
      .from(n(q, 'fact'), { opacity: 0, x: 12, stagger: .12 }, '<').addLabel('s1')
      .from(n(q, 'price'), { opacity: 0, y: 8 })
      .from(n(q, 'band'), { scaleX: 0, ...MID }, '<.1').addLabel('s2')
      .from(n(q, 'site'), { opacity: 0, stagger: .07 })
      .from(n(q, 'bar'), { scaleX: 0, transformOrigin: '0% 50%', stagger: .07 }, '<').addLabel('s3')
      .from(n(q, 'review'), { opacity: 0, y: 8 }).addLabel('s4');
  },
  buy(q, tl) {
    tl.from(n(q, 'query'), { opacity: 0, y: -8 })
      .from(n(q, 'fan'), { ...DRAW, stagger: .06 })
      .from(n(q, 'logo'), { opacity: 0, scale: .6, ...MID, stagger: .06 }, '<.1')
      .from(n(q, 'row'), { opacity: 0, stagger: .07 }).addLabel('s0')
      .from(n(q, 'ship'), { opacity: 0, stagger: .05 })
      .from(n(q, 'total'), { opacity: 0, stagger: .05 }, '<.15').addLabel('s1')
      .from(n(q, 'reason'), { opacity: 0 })
      .from(n(q, 'dim'), { opacity: 1 }, '<')
      // each row starts in the slot it arrived in and settles where the page renders it
      .from(n(q, 'row'), { y: (_, el) => num(el, 'from') * 52, duration: .8, ease: 'power3.inOut', stagger: .03 }).addLabel('s2')
      .from(n(q, 'answer'), { opacity: 0, y: 8 })
      .from(n(q, 'proof'), { opacity: 0 }, '<.2').addLabel('s3');
  },
  weigh(q, tl) {
    const dots = n(q, 'dot'), out = dots.filter(el => (el as SVGElement).dataset.out);
    tl.fromTo([...dots, ...n(q, 'ask')], { opacity: 0, scale: 0, ...MID }, { opacity: 1, scale: (_, el) => num(el, 'eq') || 1, stagger: .03 })
      .from(n(q, 'asklabel'), { opacity: 0 }, '<.3').addLabel('s0')
      .to([...n(q, 'ask'), ...n(q, 'asklabel')], { opacity: .25 }).addLabel('s1')
      .to(dots, { scale: (_, el) => num(el, 'age'), duration: .8, stagger: .02 }).addLabel('s2')
      .to(dots, { scale: 1, duration: .8, stagger: .02 }).addLabel('s3')
      .to(out, { opacity: .25 })
      .from(n(q, 'cross'), { opacity: 0 }, '<').addLabel('s4')
      .from(n(q, 'band'), { scaleX: 0, ...MID })
      .from(n(q, 'range'), { opacity: 0, y: 6 }, '<.2').addLabel('s5');
  },
  lake(q, tl) {
    const up = { opacity: 0, y: 8 };
    tl.from(n(q, 'frame'), { opacity: 0 }).from(n(q, 'landing'), up, '<.1').addLabel('s0')
      .from(n(q, 'pipeline'), { opacity: 0 }).from(n(q, 'e1'), DRAW, '<').from(n(q, 'sold_raw'), up, '<.2').addLabel('s1')
      .from(n(q, 'e2'), DRAW).from(n(q, 'gate'), { opacity: 0 }, '<.1').from(n(q, 'e2x'), DRAW, '<.2').from(n(q, 'comp'), up, '<').addLabel('s2')
      .from(n(q, 'e3'), { ...DRAW, stagger: .08 }).from(n(q, 'child'), { ...up, stagger: .08 }, '<.2').addLabel('s3')
      .from(n(q, 'e4'), DRAW).from(n(q, 'jobs'), up, '<.2').addLabel('s4')
      .from(n(q, 'e5'), DRAW).from(n(q, 'reads'), up, '<.2').addLabel('s5')
      .from(n(q, 'e6'), { ...DRAW, stagger: .15 }).from(n(q, 'export'), up, '<').from(n(q, 'server'), up, '<.2')
      .from(n(q, 'loop'), { ...DRAW, duration: 1.2, ease: 'power2.inOut' }, '<.2').from(n(q, 'packet'), { opacity: 0 }, '<.6').addLabel('s6')
      .from(n(q, 'policy'), { opacity: 0, x: 8 }).addLabel('s7');
  },
};

export function Motion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
    const page = document.querySelector<HTMLElement>('[data-engine]');
    if (!page) return;
    const mm = gsap.matchMedia();
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 761px)' }, context => {
      const { motion, wide } = context.conditions ?? {};
      if (!motion) return;
      page.dataset.motion = '';
      for (const section of page.querySelectorAll<HTMLElement>('[data-act]')) {
        const q = gsap.utils.selector(section) as Select;
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: .6 } });
        acts[section.dataset.act ?? '']?.(q, tl);
        const go = (label: string | number) => { gsap.killTweensOf(tl); tl.tweenTo(label, { ease: 'none' }); };
        const steps = q('[data-step]');
        // A figure too tall to pin beside its steps on a phone plays through once when it arrives.
        if (!wide && 'tall' in section.dataset) ScrollTrigger.create({ trigger: q('svg')[0], start: 'top 75%', onEnter: () => tl.timeScale(1.6).play() });
        else steps.forEach((step, i) => ScrollTrigger.create({
          trigger: step, start: wide ? 'top 62%' : 'top 76%', end: wide ? 'bottom 62%' : 'bottom 76%',
          onToggle: self => step.toggleAttribute('data-on', self.isActive),
          onEnter: () => go(`s${i}`), onEnterBack: () => go(`s${i}`),
          onLeaveBack: () => { if (i === 0) go(0); },
        }));
        const packets = n(q, 'packet').map(el => gsap.to(el, {
          motionPath: { path: (el as SVGElement).dataset.path ?? '' }, duration: 4.8, ease: 'none', repeat: -1, delay: num(el, 'delay'), paused: true,
        }));
        if (packets.length) ScrollTrigger.create({ trigger: section, onToggle: self => packets.forEach(p => p.paused(!self.isActive)) });
      }
      for (const rules of page.querySelectorAll('[data-rules]')) gsap.from(rules.querySelectorAll('[data-n="rule"]'), { scaleX: 0, transformOrigin: '0% 50%', duration: .7, ease: 'power3.out', stagger: .04, scrollTrigger: { trigger: rules, start: 'top 80%', once: true } });
      const answers = page.querySelector('[data-answers]');
      if (answers) gsap.from(answers.children, { opacity: 0, y: 16, duration: .6, ease: 'power3.out', stagger: .15, scrollTrigger: { trigger: answers, start: 'top 80%', once: true } });
      return () => { delete page.dataset.motion; page.querySelectorAll('[data-on]').forEach(el => el.removeAttribute('data-on')); };
    });
    return () => mm.revert();
  }, []);
  return null;
}
