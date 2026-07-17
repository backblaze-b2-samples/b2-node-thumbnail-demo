import test from "node:test";
import assert from "node:assert/strict";
import {loadConfig, resolveS3Endpoint, validateB2Region} from "../config.js";

const requiredEnv = {
  B2_APPLICATION_KEY_ID: "new-key-id",
  B2_APPLICATION_KEY: "new-application-key",
  B2_BUCKET_NAME: "photos",
  B2_REGION: "us-west-004",
  B2_PUBLIC_URL_BASE: "https://f000.backblazeb2.com/file/photos",
  RESIZE_OPTIONS: "{\"width\": 240}",
  SIGNING_SECRET: "signing-secret"
};

test("loadConfig prefers standardized B2 variables", () => {
  const config = loadConfig({
    ...requiredEnv,
    AWS_ACCESS_KEY_ID: "old-key-id",
    AWS_SECRET_ACCESS_KEY: "old-application-key",
    AWS_REGION: "us-east-005"
  });

  assert.equal(config.applicationKeyId, "new-key-id");
  assert.equal(config.applicationKey, "new-application-key");
  assert.equal(config.region, "us-west-004");
  assert.deepEqual(config.deprecatedEnvVars, []);
});

test("loadConfig accepts deprecated AWS variables during rollout", () => {
  const config = loadConfig({
    AWS_ACCESS_KEY_ID: "old-key-id",
    AWS_SECRET_ACCESS_KEY: "old-application-key",
    AWS_REGION: "us-east-005",
    RESIZE_OPTIONS: "{\"width\": 240}",
    SIGNING_SECRET: "signing-secret"
  });

  assert.equal(config.applicationKeyId, "old-key-id");
  assert.equal(config.applicationKey, "old-application-key");
  assert.equal(config.region, "us-east-005");
  assert.equal(config.bucketName, undefined);
  assert.deepEqual(
      config.deprecatedEnvVars.map(({oldName, newName}) => [oldName, newName]),
      [
        ["AWS_ACCESS_KEY_ID", "B2_APPLICATION_KEY_ID"],
        ["AWS_SECRET_ACCESS_KEY", "B2_APPLICATION_KEY"],
        ["AWS_REGION", "B2_REGION"]
      ]
  );
});

test("loadConfig reports invalid resize options JSON clearly", () => {
  assert.throws(
      () => loadConfig({
        ...requiredEnv,
        RESIZE_OPTIONS: "{invalid"
      }),
      /RESIZE_OPTIONS must contain valid JSON/
  );
});

test("validateB2Region trims and accepts valid Backblaze region tokens", () => {
  assert.equal(validateB2Region(" us-west-004 "), "us-west-004");
  assert.equal(validateB2Region("eu-central-003"), "eu-central-003");
});

test("validateB2Region rejects endpoint injection payloads", () => {
  const invalidRegions = [
    "x@127.0.0.1:8443/probe",
    "us-west-004/probe",
    "us-west-004?probe",
    "us-west-004#probe",
    "us-west-004:443",
    "us west 004",
    "US-WEST-004",
    "https://s3.us-west-004.backblazeb2.com"
  ];

  for (const region of invalidRegions) {
    assert.throws(() => validateB2Region(region), /Backblaze B2 region token/);
  }
});

test("resolveS3Endpoint rejects hostile endpoint overrides", () => {
  const invalidEndpoints = [
    "https://s3.us-west-004.backblazeb2.com@127.0.0.1:8443/probe",
    "http://s3.us-west-004.backblazeb2.com",
    "https://s3.us-west-004.backblazeb2.com/probe",
    "https://s3.us-west-004.backblazeb2.com?probe",
    "https://s3.us-east-005.backblazeb2.com"
  ];

  for (const endpoint of invalidEndpoints) {
    assert.throws(() => resolveS3Endpoint("us-west-004", endpoint), /AWS_ENDPOINT_URL/);
  }
});

test("resolveS3Endpoint accepts the expected Backblaze S3 endpoint", () => {
  assert.equal(
      resolveS3Endpoint("us-west-004", " https://s3.us-west-004.backblazeb2.com/ "),
      "https://s3.us-west-004.backblazeb2.com"
  );
});
