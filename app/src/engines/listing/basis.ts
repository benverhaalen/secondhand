export const BASIS_LEVELS = ['variant', 'product', 'family', 'kind', 'prior'] as const;
export type BasisLevel = typeof BASIS_LEVELS[number];

export function basisLevel(value: BasisLevel = 'variant'): BasisLevel {
  if (!BASIS_LEVELS.includes(value)) throw new RangeError(`invalid basis_level ${value}`);
  return value;
}

export function lowestBasis(levels: (BasisLevel | undefined)[]): BasisLevel {
  return levels.reduce<BasisLevel>((lowest, value) => {
    const level = basisLevel(value);
    return BASIS_LEVELS.indexOf(level) > BASIS_LEVELS.indexOf(lowest) ? level : lowest;
  }, 'variant');
}
