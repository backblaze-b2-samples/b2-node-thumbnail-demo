import {timingSafeEqual} from "node:crypto";

const HMAC_SHA256_HEX_LENGTH = 64;

export function isValidSignature(receivedSig, calculatedSig) {
  const hmacPattern = new RegExp(`^[a-f0-9]{${HMAC_SHA256_HEX_LENGTH}}$`, "i");
  if (!hmacPattern.test(receivedSig) || !hmacPattern.test(calculatedSig)) {
    return false;
  }

  const received = Buffer.from(receivedSig, "hex");
  const calculated = Buffer.from(calculatedSig, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}
