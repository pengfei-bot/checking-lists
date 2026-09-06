import * as Crypto from "expo-crypto";

/** Ambiguous chars removed (0/O, 1/I) for easier family sharing. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function generateInviteCode(length = 6): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
