import Image from 'next/image';

export function AppPreviewImage({ name, alt, sizes, eager = false }: {
  name: string;
  alt: string;
  sizes: string;
  eager?: boolean;
}) {
  return <Image
    src={`/marketing/app/${name}.png?v=22f37f6d`}
    alt={alt}
    width={880}
    height={1840}
    sizes={sizes}
    loading={eager ? 'eager' : 'lazy'}
    quality={85}
  />;
}
