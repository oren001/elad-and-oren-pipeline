import { getKv } from "./kv";
import { b64urlEncode } from "./b64";

const VAPID_KEYS_KEY = "vapid:keys";

export type VapidKeys = {
  privatePkcs8: string;
  publicRaw: string;
};

export async function getOrCreateVapidKeys(): Promise<VapidKeys | null> {
  const kv = getKv();
  if (!kv) return null;

  const cached = await kv.get(VAPID_KEYS_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as VapidKeys;
      if (parsed.privatePkcs8 && parsed.publicRaw) return parsed;
    } catch {
      // regenerate
    }
  }

  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const privatePkcs8Buf = await crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey,
  );
  const publicRawBuf = await crypto.subtle.exportKey(
    "raw",
    keyPair.publicKey,
  );

  const keys: VapidKeys = {
    privatePkcs8: b64urlEncode(new Uint8Array(privatePkcs8Buf)),
    publicRaw: b64urlEncode(new Uint8Array(publicRawBuf)),
  };

  await kv.put(VAPID_KEYS_KEY, JSON.stringify(keys));
  return keys;
}
