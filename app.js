import bodyParser from "body-parser";
import express from "express";
import sharp from "sharp";
import {StatusCodes} from "http-status-codes";
import {ListBucketsCommand, S3} from "@aws-sdk/client-s3";
import {getEndpointFromInstructions} from "@smithy/middleware-endpoint";
import {createHmac} from "node:crypto";
import dotenv from "dotenv"

// Get the resolved S3 endpoint - very useful for debugging!
// See https://github.com/aws/aws-sdk-js-v3/issues/4122#issuecomment-1298968804
async function getS3Endpoint(client) {
  const command = new ListBucketsCommand({});
  return getEndpointFromInstructions(command.input, ListBucketsCommand, client.config);
}

// Log a message to the console and throw an error
function throwError(response, status, message, detail) {
  const errMessage = `${message}: ${detail}`;
  console.error(errMessage);
  throw new Error(errMessage);
}

// Verify the Event Notification message signature, throwing an appropriate error if the
// signature is invalid
function verifySignature(request, response, buffer, _encoding) {
  if ('x-bz-event-notification-signature' in request.headers) {
    // Verify that signature has form "v1=2c8...231"
    const signature = request.headers['x-bz-event-notification-signature'];
    const pair = signature.split('=');
    if (!pair || pair.length !== 2) {
      throwError(response, 401, 'Invalid signature format', signature);
    }
    const version = pair[0];
    if (version !== 'v1') {
      throwError(response, 401, 'Invalid signature version', version);
    }

    // Now calculate the HMAC and compare it with the one sent in the header
    const receivedSig = pair[1];
    const calculatedSig = createHmac('sha256', SIGNING_SECRET)
        .update(buffer)
        .digest('hex');
    if (receivedSig !== calculatedSig) {
      throwError(response,
          401,
          'Invalid signature',
          `Received ${receivedSig}; calculated ${calculatedSig}`
      );
    }
  } else {
    throwError(response, 401, 'Missing signature header', '');
  }

  // Success!
  console.log('Signature is valid');
}

// Create a thumbnail image
async function createThumbnail(bucket, keyBase, extension) {
  try {
    const key = keyBase + (extension ? "." + extension : "");

    // Get the image from B2 (returns a readable stream as the body)
    console.log(`Fetching image from b2://${bucket}/${key}`);
    const obj = await client.getObject({
      Bucket: bucket,
      Key: key
    });

    // Create a Sharp transformer into which we can stream image data
    const transformer = sharp()
        .rotate()                // Auto-orient based on the EXIF Orientation tag
        .resize(RESIZE_OPTIONS); // Resize according to configured options

    // Pipe the image data into the transformer
    // Suppress the warning that pipe() cannot be resolved - it's an artifact of the AWS SDK
    // noinspection JSUnresolvedFunction
    obj.Body.pipe(transformer);

    // We can read the transformer output into a buffer, since we know
    // that thumbnails are small enough to fit in memory
    const thumbnail = await transformer.toBuffer();

    // By default, Sharp output format will match the input image, except SVG input which becomes PNG output.
    const outputContentType = (obj.ContentType === "image/svg+xml") ? "image/png" : obj.ContentType;

    // image.png -> image_tn.png
    // image -> image_tn
    const outputKey = keyBase + TN_SUFFIX + (extension ? "." + extension : "");

    // Write the thumbnail buffer to the same B2 bucket as the original
    console.log(`Writing thumbnail to b2://${bucket}/${outputKey}`);
    await client.putObject({
      Bucket: bucket,
      Key: outputKey,
      Body: thumbnail,
      ContentType: outputContentType
    });
  } catch (err) {
    console.log(err);
  }
}

// Thumbnail suffix to add to base filename
const TN_SUFFIX = '_tn';

// File extensions we'll work with
const IMAGE_EXTENSIONS = [
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpg", "jpeg",
  "png",
  "svg",
  "tif", "tiff",
  "webp",
]

// Never, ever, ever put credentials in code!
// 'override' is useful in dev so that .env file overrides environment variables
// In production, we want to give environment variables precedence
dotenv.config({ override: (process.env.NODE_ENV === 'development') });

// Read configuration from the environment
const RESIZE_OPTIONS = JSON.parse(process.env.RESIZE_OPTIONS);
const SIGNING_SECRET = process.env.SIGNING_SECRET;

// Create an S3 client object
//
// The S3 client constructor will look for configuration in environment variables,
// then the shared credentials file, etc.
// See https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html
const client = new S3();

// Sanity check - we should always be able to list buckets
try {
  const response = await client.listBuckets();
  const endpoint = await getS3Endpoint(client);
  console.log(`Successfully called S3 service at ${endpoint.url}: ${response.Buckets.length} buckets listed`);
} catch (error) {
  console.error(`Error listing buckets: ${error}`);
  process.exit(1);
}

// Set up Express
const router = express.Router();
const app = express();

// Call verifySignature with the raw request payload, then parse request body as JSON
app.use(bodyParser.json({verify: verifySignature}));

// Handle POST requests at /thumbnail
router.post('/thumbnail', async (request,response) => {
  const event = request.body['events'][0];

  // Handle test events
  if (event['eventType'] === 'b2:TestEvent') {
    console.log('Replying to test event');
    response.end();
    return;
  }

  const bucket = event['bucketName'];
  const key = event['objectName'];
  const lastDot = key.lastIndexOf('.');
  const keyBase= (lastDot === -1) ? key : key.substring(0, lastDot);
  const extension = (lastDot === -1) ? undefined : key.substring(lastDot + 1);

  // Only process image files (check extension)
  // Only operate on ObjectCreated events
  // Bucket and key must be present in the input message
  // Don't make thumbnails of thumbnails
  const extensionLower = extension?.toLowerCase();
  if (!(IMAGE_EXTENSIONS.includes(extensionLower))
      || !(event['eventType'].startsWith('b2:ObjectCreated:'))
      || !(bucket && keyBase)
      || keyBase.endsWith(TN_SUFFIX)) {
    console.log(`Skipping b2://${bucket}/${key}`);
    response.sendStatus(StatusCodes.NO_CONTENT).end();
    return;
  }

  // We don't want to keep Backblaze B2 waiting longer than we have to, so send the response here,
  // then create the thumbnail. In a real-world app you would use a task queue to reliably create
  // the thumbnail asynchronously.
  response.end();

  await createThumbnail(bucket, keyBase, extension);
});

app.use("/", router);

// Default to listen on 3000
const port = process.env.PORT || 3000;

app.listen(port,() => {
  console.log(`Listening on port ${port}`);
})
