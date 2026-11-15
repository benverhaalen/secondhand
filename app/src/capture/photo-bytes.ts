// On the web a picked or taken photo is a blob: or data: address the browser reads itself.
export const photoBytes = async (uri: string): Promise<Uint8Array> => new Uint8Array(await (await fetch(uri)).arrayBuffer());
