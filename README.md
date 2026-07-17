# Backblaze B2 Event Notifications Demo: Thumbnail Creator in Node.js

This app receives a Backblaze Event Notification message, validates the 
message signature, and, if the message concerns a newly-created image
file, creates a thumbnail image and uploads it to the same bucket as
the image file.

## Prerequisites

Follow these instructions, as necessary, to create a Backblaze B2 account, 
bucket and application key:

* [Create a Backblaze B2 Account](https://www.backblaze.com/sign-up/cloud-storage).
* [Create a Backblaze B2 Bucket](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets).
* [Create an Application Key](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys#create-an-app-key) with access to the bucket you wish to use.

Be sure to copy the application key as soon as you create it, as you will not be able to retrieve it later!

## Configuration

Copy [`.env.example`](.env.example) to `.env`, then paste in your application
key, bucket, etc. The `B2_*` names are the canonical configuration names.
During rollout from an older deployment, the app also accepts the deprecated
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and
`AWS_ENDPOINT_URL` names as fallbacks. If both old and new names are present,
the `B2_*` value takes precedence.

`B2_BUCKET_NAME` is recommended for new deployments because it enables a startup
bucket access check. Event processing still uses the `bucketName` in each
Backblaze Event Notification payload, so one service can process valid image
events from multiple buckets.

`B2_PUBLIC_URL_BASE` is optional. Set it only when the bucket is public and you
want the app to log the public URL for each generated thumbnail. For the
standard Backblaze file URL, use
`https://f<account-id>.backblazeb2.com/file/<bucket-name>` and replace the
placeholders with your account and bucket values.

## Running the App Locally

Install dependencies:

```shell
npm install
```

Start the app:

```shell
npm start
```

At startup, the app logs the configured Backblaze B2 S3 endpoint. If
`B2_BUCKET_NAME` is set, it also verifies access to that bucket before
listening for requests on port 3000:

```console
> b2-node-thumbnail-demo@1.0.0 start
> node app.js

Configured S3 service endpoint: https://s3.<your-region>.backblazeb2.com
<your-bucket> bucket is accessible
Listening on port 3000
```

You can set the PORT environment variable to override the default, e.g.:

```console
% PORT=80 npm start

> b2-node-thumbnail-demo@1.0.0 start
> node app.js

Configured S3 service endpoint: https://s3.<your-region>.backblazeb2.com
<your-bucket> bucket is accessible
Listening on port 80
```

You can use [ngrok](https://ngrok.com/) or [TryCloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) to create
an Internet-addressable endpoint to test the app with Event Notifications:

```shell
ngrok http http://localhost:3000
```

or

```shell
cloudflared tunnel --url http://localhost:3000
```

Make a note of the resulting URL. You will use this as the target URL 
when you create an Event Notification rule. 

## Running the App on Docker

### Building a Docker Image

You will need to build a Docker image. Note that Docker defaults to building an image for
the platform on which it is running, so, if you are working on a Mac with an Apple CPU and 
you will be deploying to a Linux VM running on Intel, you must specify the `--platform` flag.
For example:

```shell
docker build --platform linux/amd64 .
```

You can then tag and push the image to the repository of your choice. 
Alternatively, you can combine building, tagging and pushing into a single command: 

```shell
docker build --push --platform linux/amd64 --tag docker_user/b2-node-thumbnail-demo:1.0.0 .
```

If you are using `containerd` for pulling and storing images, you can build a 
multi-platform image:

```shell
docker build \
--push \
--platform linux/arm/v7,linux/arm64/v8,linux/amd64 \
--tag docker_user/b2-node-thumbnail-demo:1.0.0 .
```

### Running the App in a New Local Docker Container

When running the app, you must:

* Use the `-p` flag to bind port `3000` of the container to an
  available port on the host.
* Specify values for the required environment variables listed in
  `.env.example`, via multiple uses of the `-e`/`--env` flag or by using the
  `--env-file` flag to load the environment variables from a file. Optional
  variables in `.env.example` may be omitted.

For example, to use port `80` on the host and load environment variables from 
the `.env` file, you would run:

```shell
docker run -p 80:3000 --env-file .env docker_user/b2-node-thumbnail-demo:1.0.0
```

Again, you can use [ngrok](https://ngrok.com/) or [TryCloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) to create
an Internet-addressable endpoint, noting the URL to use as the target URL in your Event
Notification rule:

```shell
ngrok http http://localhost:3000
```

or

```shell
cloudflared tunnel --url http://localhost:3000
```

### Running the App on a Cloud Compute Provider

You should be able to run the app on any cloud compute provider. Note that 
you must configure the port and environment variables similarly to running 
the app locally, and make a note of your app's public URL.

Check the application log for the `Configured S3 service endpoint` message. If
`B2_BUCKET_NAME` is set, also check for the bucket access message. If you do not
see these, then look for an error message, and check the app configuration.

## Creating an Event Notification Rule

Follow [this tutorial](https://www.backblaze.com/docs/cloud-storage-create-and-use-event-notifications) to create an Event Notification rule, using the URL that you noted earlier rather than the Webhook.site endpoint.

## Verifying that the App Creates Thumbnails

Use the Backblaze B2 web UI to upload an image file to your bucket. Wait a few seconds, then refresh the bucket listing. You should see the thumbnail file in the bucket.

If you do not see the thumbnail file, check the application log.
