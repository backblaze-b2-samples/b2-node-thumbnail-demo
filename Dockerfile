# Based on the Docker Node.js sample Dockerfile published at
# https://docs.docker.com/language/nodejs/containerize/
ARG NODE_VERSION=22.2.0

FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/app

COPY package*.json .

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

USER node

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD npm start
