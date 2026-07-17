const B2_REGION_PATTERN = /^[a-z]{2}(?:-[a-z]+)+-\d{3}$/;

function trimmedEnv(env, name) {
  const value = env[name];
  return typeof value === "string" ? value.trim() : undefined;
}

function readRequiredEnv(env, primaryName, fallbackName) {
  const primaryValue = trimmedEnv(env, primaryName);
  if (primaryValue) {
    return {
      name: primaryName,
      value: primaryValue,
      deprecatedFallback: undefined
    };
  }

  const fallbackValue = fallbackName ? trimmedEnv(env, fallbackName) : undefined;
  if (fallbackValue) {
    return {
      name: fallbackName,
      value: fallbackValue,
      deprecatedFallback: {
        oldName: fallbackName,
        newName: primaryName
      }
    };
  }

  const fallbackMessage = fallbackName ? ` (or deprecated ${fallbackName})` : "";
  throw new Error(`Missing required environment variable: ${primaryName}${fallbackMessage}`);
}

function parseJsonEnv(name, value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
}

export function validateB2Region(rawRegion, sourceName = "B2_REGION") {
  const region = rawRegion?.trim();
  if (!region || !B2_REGION_PATTERN.test(region)) {
    throw new Error(`${sourceName} must be a Backblaze B2 region token such as us-west-004`);
  }

  return region;
}

export function resolveS3Endpoint(region, rawEndpoint) {
  const expectedHost = `s3.${region}.backblazeb2.com`;
  const expectedEndpoint = `https://${expectedHost}`;
  const endpoint = rawEndpoint?.trim();

  if (!endpoint) {
    return expectedEndpoint;
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`AWS_ENDPOINT_URL must be an HTTPS Backblaze S3 endpoint matching ${expectedEndpoint}`);
  }

  const hasPath = url.pathname && url.pathname !== "/";
  if (url.protocol !== "https:"
      || url.hostname !== expectedHost
      || url.username
      || url.password
      || hasPath
      || url.search
      || url.hash) {
    throw new Error(`AWS_ENDPOINT_URL must resolve to ${expectedEndpoint}`);
  }

  return url.origin;
}

export function loadConfig(env = process.env) {
  const applicationKeyId = readRequiredEnv(env, "B2_APPLICATION_KEY_ID", "AWS_ACCESS_KEY_ID");
  const applicationKey = readRequiredEnv(env, "B2_APPLICATION_KEY", "AWS_SECRET_ACCESS_KEY");
  const regionConfig = readRequiredEnv(env, "B2_REGION", "AWS_REGION");
  const resizeOptions = readRequiredEnv(env, "RESIZE_OPTIONS");
  const signingSecret = readRequiredEnv(env, "SIGNING_SECRET");
  const region = validateB2Region(regionConfig.value, regionConfig.name);

  return {
    applicationKeyId: applicationKeyId.value,
    applicationKey: applicationKey.value,
    bucketName: trimmedEnv(env, "B2_BUCKET_NAME"),
    publicUrlBase: trimmedEnv(env, "B2_PUBLIC_URL_BASE"),
    region,
    resizeOptions: parseJsonEnv(resizeOptions.name, resizeOptions.value),
    signingSecret: signingSecret.value,
    s3Endpoint: resolveS3Endpoint(region, trimmedEnv(env, "AWS_ENDPOINT_URL")),
    deprecatedEnvVars: [
      applicationKeyId.deprecatedFallback,
      applicationKey.deprecatedFallback,
      regionConfig.deprecatedFallback
    ].filter(Boolean)
  };
}
