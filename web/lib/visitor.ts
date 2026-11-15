type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export function createVisitor(storage: () => StoragePort, onError: (error: unknown) => void = () => undefined): () => string {
  let memory: string | undefined;
  return () => {
    if (memory) return memory;
    const fresh = `vis_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      const saved = storage().getItem('secondhand.visitor');
      memory = saved && /^vis_[a-z0-9]{8,32}$/.test(saved) ? saved : fresh;
      storage().setItem('secondhand.visitor', memory);
    } catch (error) { memory = fresh; onError(error); }
    return memory;
  };
}
