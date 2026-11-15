type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
// The server issues and signs visitor ids and returns one in X-Visitor-Id; the page keeps whichever id the server last returned.
const SHAPE = /^vis_[a-z0-9]{8,64}$/;
export function createVisitor(storage: () => StoragePort, onError: (error: unknown) => void = () => undefined): (adopt?: string | null) => string {
  let memory: string | undefined;
  return (adopt?: string | null) => {
    if (adopt && SHAPE.test(adopt) && adopt !== memory) {
      memory = adopt;
      try { storage().setItem('secondhand.visitor', adopt); } catch (error) { onError(error); }
      return memory;
    }
    if (memory) return memory;
    const fresh = `vis_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      const saved = storage().getItem('secondhand.visitor');
      memory = saved && SHAPE.test(saved) ? saved : fresh;
      storage().setItem('secondhand.visitor', memory);
    } catch (error) { memory = fresh; onError(error); }
    return memory;
  };
}
