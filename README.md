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

Copy [`.env.template`](.env.template) to `.env`, then paste in your application 
key, endpoint, etc.:

```dotenv
AWS_ACCESS_KEY_ID=<Your Backblaze B2 Application Key ID>
AWS_SECRET_ACCESS_KEY=<Your Backblaze B2 Application Key>
AWS_ENDPOINT_URL=https://<Your Backblaze B2 bucket endpoint>
AWS_REGION=<Your Backblaze B2 bucket region>
RESIZE_OPTIONS={"width": 240, "withoutEnlargement": true}
SIGNING_SECRET=<Your Event Notification rule signing secret>
NODE_ENV=development
```

## Running the App Locally

Install dependencies:

```shell
npm install
```

Start the app:

```shell
npm start
```

By default, the app will verify that it can access Backblaze B2, then start 
listening for requests on port 3000:

```console
> b2-node-thumbnail-demo@1.0.0 start
> node app.js

Successfully called S3 service at https://s3.us-west-004.backblazeb2.com/: 61 buckets listed
Listening on port 3000
```

You can set the PORT environment variable to override the default, e.g.:

```console
% PORT=80 npm start

> b2-node-thumbnail-demo@1.0.0 start
> node app.js

Successfully called S3 service at https://s3.us-west-004.backblazeb2.com/: 61 buckets listed
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
* Specify values for the environment variables listed in `.env.template`, via 
multiple uses of the `-e`/`--env` flag or by using the `--env-file` flag to load
the environment variables from a file.

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

Check the application log for the `Successfully called S3 service` message. 
If you do not see this, then look for an error message, and check the app
configuration.

## Creating an Event Notification Rule

Follow [this tutorial](https://www.backblaze.com/docs/cloud-storage-create-and-use-event-notifications) to create an Event Notification rule, using the URL that you noted earlier rather than the Webhook.site endpoint.

## Verifying that the App Creates Thumbnails

Use the Backblaze B2 web UI to upload an image file to your bucket. Wait a few seconds, then refresh the bucket listing. You should see the thumbnail file in the bucket.

If you do not see the thumbnail file, check the application log.
