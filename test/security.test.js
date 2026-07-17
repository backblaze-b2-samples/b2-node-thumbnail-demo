import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {isValidSignature} from "../security.js";

test("isValidSignature accepts a matching HMAC signature", () => {
  const body = Buffer.from("{\"events\":[]}");
  const signature = createHmac("sha256", "secret").update(body).digest("hex");

  assert.equal(isValidSignature(signature, signature), true);
});

test("isValidSignature rejects malformed and mismatched signatures", () => {
  const signature = createHmac("sha256", "secret").update("payload").digest("hex");

  assert.equal(isValidSignature(signature.replace(/^./, "0"), signature), false);
  assert.equal(isValidSignature(signature.slice(1), signature), false);
  assert.equal(isValidSignature("not-hex", signature), false);
});
