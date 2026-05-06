import { b64urlEncode, b64urlDecode, utf8, concat } from "./b64";
import { getOrCreateVapidKeys, type VapidKeys } from "./vapid";

function bufferOf(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength,
  ) as ArrayBuffer;
}

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type WebPushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string; gone: boolean };

const SUBJECT = "mailto:halviinim@example.com";

export async function sendWebPush(
  sub: WebPushSubscription,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<WebPushResult> {
  const vapid = await getOrCreateVapidKeys();
  if (!vapid) {
    return { ok: false, status: 500, error: "no_vapid_keys", gone: false };
  }

  const url = new URL(sub.endpoint);
  const aud = `${url.protocol}//${url.host}`;

  const jwt = await signVapidJwt(vapid, aud);

  const body = JSON.stringify(payload);
  const encrypted = await encryptAes128Gcm(
    sub.keys.p256dh,
    sub.keys.auth,
    utf8(body),
  );

  let res: Response;
  try {
    res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        authorization: `vapid t=${jwt}, k=${vapid.publicRaw}`,
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
      },
      body: encrypted.buffer as ArrayBuffer,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, status: 0, error: msg, gone: false };
  }

  const gone = res.status === 410 || res.status === 404;
  if (res.status >= 200 && res.status < 300) {
    return { ok: true, status: res.status };
  }
  let errBody = "";
  try {
    errBody = (await res.text()).slice(0, 200);
  } catch {
    // ignore
  }
  return {
    ok: false,
    status: res.status,
    error: errBody,
    gone,
  };
}

async function signVapidJwt(vapid: VapidKeys, aud: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: SUBJECT,
  };
  const headerB64 = b64urlEncode(utf8(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(utf8(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    bufferOf(b64urlDecode(vapid.privatePkcs8)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    bufferOf(utf8(signingInput)),
  );
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function encryptAes128Gcm(
  clientPubB64: string,
  authB64: string,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const clientPubRaw = b64urlDecode(clientPubB64);
  const authSecret = b64urlDecode(authB64);

  const ephemeral = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey),
  );

  const clientPubKey = await crypto.subtle.importKey(
    "raw",
    bufferOf(clientPubRaw),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPubKey },
      ephemeral.privateKey,
      256,
    ),
  );

  const prkKey = await hmacSha256(authSecret, ecdhSecret);

  const keyInfo = concat(
    utf8("WebPush: info\0"),
    clientPubRaw,
    serverPubRaw,
  );
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);

  const cek = await hkdfExpand(
    prk,
    utf8("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(prk, utf8("Content-Encoding: nonce\0"), 12);

  const plaintext = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    bufferOf(cek),
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt"],
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: bufferOf(nonce) },
      aesKey,
      bufferOf(plaintext),
    ),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([serverPubRaw.length]);

  return concat(salt, rs, idlen, serverPubRaw, ciphertext);
}

async function hmacSha256(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    bufferOf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, bufferOf(data));
  return new Uint8Array(sig);
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  let written = 0;
  let prev: Uint8Array = new Uint8Array(0);
  let counter = 1;
  while (written < length) {
    const data = concat(prev, info, new Uint8Array([counter]));
    const block: Uint8Array = await hmacSha256(prk, data);
    const toCopy = Math.min(block.length, length - written);
    out.set(block.subarray(0, toCopy), written);
    written += toCopy;
    prev = new Uint8Array(block);
    counter++;
  }
  return out;
}
