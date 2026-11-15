const roots = ['app/', 'log/', 'spec/', 'jobs/capture/', 'research/list/ben/platforms/', 'scripts/'];
export const touchesApp = paths => paths.some(path => roots.some(root => path.startsWith(root)));

export function debounce(previous, { sha, relevant, now, immediate = false }) {
  const changedAt = previous.sha === sha ? previous.changedAt : now;
  return { sha, changedAt, ready: immediate || (relevant && now - changedAt >= 180000) };
}

export function patchSwift(source) {
  const original = /^([ \t]*)try JavaScriptActor\.assumeIsolated \{\n\1  try encode\(JavaScriptValue\.Slot\(slot\), runtime\)\n\1\}/m;
  const patched = /^([ \t]*)let slotAddress = UInt\(bitPattern: slot\)\n\1try JavaScriptActor\.assumeIsolated \{\n\1  try encode\(JavaScriptValue\.Slot\(UnsafeMutablePointer<facebook\.jsi\.Value>\(bitPattern: slotAddress\)!\), runtime\)\n\1\}/m;
  if (original.test(source)) return source.replace(original, (_, indent) => `${indent}let slotAddress = UInt(bitPattern: slot)\n${indent}try JavaScriptActor.assumeIsolated {\n${indent}  try encode(JavaScriptValue.Slot(UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: slotAddress)!), runtime)\n${indent}}`);
  if (patched.test(source)) return source;
  throw new Error('Swift patch: neither the original nor patched slot closure was found.');
}

const version = value => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '')?.slice(1).map(Number);
export function findNode(pathNode, nvmNodes) {
  if ((version(pathNode?.version)?.[0] ?? 0) >= 22) return pathNode.path;
  const candidates = nvmNodes.filter(node => { const major = version(node.version)?.[0]; return major >= 22 && major <= 29; });
  candidates.sort((a, b) => {
    const av = version(a.version), bv = version(b.version);
    return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2];
  });
  if (!candidates.length) throw new Error('Node 22+ is required on PATH or in ~/.nvm/versions/node/v2[2-9]*/bin/node.');
  return candidates[0].path;
}

export function buildSummary(data) {
  const byId = {};
  let errors = null, warnings = null;
  if (data.checks) {
    errors = 0; warnings = 0;
    for (const finding of data.checks.findings) {
      const counts = byId[finding.id] ??= { errors: 0, warnings: 0 };
      if (finding.level === 'ERROR') { errors++; counts.errors++; }
      if (finding.level === 'WARN') { warnings++; counts.warnings++; }
    }
    for (const id of Object.keys(data.checks.summary ?? {})) byId[id] ??= { errors: 0, warnings: 0 };
  }
  return { sha: data.sha ?? null, subject: data.subject ?? null, target: data.target ?? null,
    installed: data.installed ?? false, profileExpires: data.profileExpires ?? null,
    checks: { errors, warnings, byId }, crashes: data.crashes ?? null, resultsDir: data.resultsDir ?? null,
    ...(data.notice ? { notice: data.notice } : {}),
    ...(data.failedStep ? { failedStep: data.failedStep, error: data.error } : {}) };
}
