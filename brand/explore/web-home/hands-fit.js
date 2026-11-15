// The hands sit tight to the wordmark: each drawn hand (not its icon box) is as tall as the wordmark's ink, from the top
// of the d and h to the baseline, stands on the same baseline, and sits a fifth of the type size away (Ben, 07:34). Icon
// boxes carry padding that differs by pack, so this crops each hand's viewBox to what is drawn, then sizes and places it
// from the wordmark's measured ascent and baseline.
//   fitHands(lockup, word, [left, right]): lockup is the flex row, word the wordmark element, then the two <svg> hands.
// Returns the gap in px, so an animation that parts the hands can end where the lockup rests.
window.fitHands = (lockup, word, hands) => {
  const cs = getComputedStyle(word), size = parseFloat(cs.fontSize), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ink = ctx.measureText(word.textContent.trim()).actualBoundingBoxAscent;
  if (!ink) return 0;
  // Where the baseline is: an empty inline-block's bottom edge sits on it.
  const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0';
  word.append(probe); const above = word.getBoundingClientRect().bottom - probe.getBoundingClientRect().top; probe.remove();
  const gap = Math.round(size * 0.2);
  lockup.style.alignItems = 'flex-end';
  [...hands].forEach((svg, i) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')) {
      const s = getComputedStyle(el), stroked = s.stroke !== 'none' && s.stroke !== 'rgba(0, 0, 0, 0)';
      if (s.fill === 'none' && !stroked) continue;
      const b = el.getBBox(), pad = stroked ? parseFloat(s.strokeWidth) / 2 : 0;
      x0 = Math.min(x0, b.x - pad); y0 = Math.min(y0, b.y - pad); x1 = Math.max(x1, b.x + b.width + pad); y1 = Math.max(y1, b.y + b.height + pad);
    }
    if (!isFinite(x0)) return;
    svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    Object.assign(svg.style, { display: 'block', height: `${ink}px`, width: `${ink * (x1 - x0) / (y1 - y0)}px`, marginBottom: `${above}px`,
      marginLeft: i ? `${gap}px` : '0px', marginRight: i ? '0px' : `${gap}px` });
  });
  lockup.style.gap = '0px';
  return gap;
};
