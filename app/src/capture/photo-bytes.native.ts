// A photo's bytes read natively from its file (expo-file-system File.arrayBuffer); no base64 copy is ever held in JS.
import { File } from 'expo-file-system';

export const photoBytes = async (uri: string): Promise<Uint8Array> => new Uint8Array(await new File(uri).arrayBuffer());
