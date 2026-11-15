const widths = [320, 480, 720] as const;

export function AppPreviewImage({ name, alt, sizes, eager = false }: {
  name: string;
  alt: string;
  sizes: string;
  eager?: boolean;
}) {
  const source = `/marketing/app/${name}`;
  const sources = widths.map(width => `${source}-${width}.webp ${width}w`).join(', ');
  return <img
    src={`${source}-480.webp`}
    srcSet={sources}
    sizes={sizes}
    alt={alt}
    width={880}
    height={1840}
    loading={eager ? 'eager' : 'lazy'}
    fetchPriority={eager ? 'high' : undefined}
    decoding={eager ? 'sync' : 'async'}
  />;
}
