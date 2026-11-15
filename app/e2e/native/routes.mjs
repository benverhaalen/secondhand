const safeSlug = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const stage = { slug: 'stage', route: '/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook' };

function normalize(route) {
  const path = route.replace(/^\/?\(tabs\)\//, '').replace(/^index(?=\?|$)/, '').replace(/\/index(?=\?|$)/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

export function routesFromRenders(renders, selected = []) {
  const routes = renders.filter(({ route }) => typeof route === 'string' && !/\[[^\]]+\]/.test(route))
    .map(({ slug, route }) => ({ slug, route: normalize(route) }))
    .filter(({ slug }) => slug !== 'stage');
  routes.push(stage);
  if (!selected.length) return routes;
  const chosen = selected.map(value => {
    const found = routes.find(({ slug }) => slug === value)
      ?? routes.find(({ route }) => route === normalize(value));
    if (!found) throw new Error(`No render for ${value}; use a render slug or its route.`);
    return found;
  });
  // Camera last: on a real phone, opening the camera ends the test runner's connection, so nothing after it would be saved.
  const unique = [...new Map(chosen.map(route => [route.slug, route])).values()];
  return [...unique.filter(r => !/^camera/.test(r.slug)), ...unique.filter(r => /^camera/.test(r.slug))];
}

export function attachmentToSlug(name) {
  // xcresulttool names a tree "<slug>_0_<UUID>.tree" (no .txt) or "<slug>.tree_0_<UUID>.txt", depending on its version.
  const late = /^(.*?)_\d+_[0-9a-f-]+\.tree$/i.exec(name);
  if (late && safeSlug.test(late[1])) return { slug: late[1], kind: 'tree' };
  const match = /^(.*?)(\.tree)?_\d+_[0-9a-f-]+\.(png|txt)$/i.exec(name);
  if (!match || !safeSlug.test(match[1])) return null;
  if (match[2] && match[3] === 'txt') return { slug: match[1], kind: 'tree' };
  if (!match[2] && match[3] === 'png') return { slug: match[1], kind: 'png' };
  return null;
}

export function routesEnv(routes) {
  return routes.map(({ slug, route }) => {
    if (!safeSlug.test(slug) || !route.startsWith('/') || /[;|\r\n]/.test(route)) {
      throw new Error(`Invalid harness route: ${slug}`);
    }
    return `${slug}|${route}`;
  }).join(';');
}
