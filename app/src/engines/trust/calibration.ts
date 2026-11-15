export type Calib = { kind?: string; a?: number; b?: number; xs?: number[]; ys?: number[]; n?: number; positives?: number; ece?: number; score_model_version?: number };
export function sigmoid(z: number): number {
  if (!Number.isFinite(z)) throw new RangeError('z');
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, z)))); // Fixed numeric contract shared with jobs/trust: clip before exp.
}
export function calibrate(z: number, c: Calib): number {
  if (!Number.isFinite(z)) throw new RangeError('z');
  if (c.kind === 'none') return sigmoid(z);
  if (c.kind === 'platt') {
    if (!Number.isFinite(c.a) || !Number.isFinite(c.b)) throw new RangeError('platt coefficients');
    return sigmoid(c.a! * z + c.b!);
  }
  if (c.kind !== 'isotonic' || !c.xs?.length || c.xs.length !== c.ys?.length) throw new RangeError('isotonic knots');
  for (let i = 0; i < c.xs.length; i++) {
    if (!Number.isFinite(c.xs[i]) || !Number.isFinite(c.ys[i]) || c.ys[i] < 0 || c.ys[i] > 1 ||
        (i > 0 && (c.xs[i] < c.xs[i - 1] || c.ys[i] < c.ys[i - 1]))) throw new RangeError('isotonic knots');
  }
  let y = c.ys[0];
  for (let i = 0; i < c.xs.length; i++) if (c.xs[i] <= z) y = c.ys[i];
  return y;
}
