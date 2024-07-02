# pacman
A clone of the classical Pac-Man game

The game runs entirely in the browser, and is served by a simple NodeJS backend which stores highscores and user stats in a MongoDB database.

## Install dependencies

```
npm install
```

## Getting started

```
npm run start
```

## Development

```
npm run dev
```

It assumes a mongodb server running locally.

## Create Application Container Image

### Container Image

The [Dockerfile](docker/Dockerfile) performs the following steps:

1. It uses the ubi9/nodejs-18-minimal from Red Hat as base image.
1. It clones the Pac-Man game (static files and code of backend) into the configured application directory.
1. It exposes port 8080 for the web server.
1. It starts the Node.js application using `npm start`.

To build the image run:

```
cd docker
podman build -t <registry>/<user>/pacman-nodejs-app .
```

You can test it by running:

```
podman create --name pacman -p 8080:8080 --pod new:pacman-app <registry>/<user>/pacman-nodejs-app
podman create --name mongo --pod pacman-app docker.io/bitnami/mongodb:5.0.14
podman pod start pacman-app
```
This will start a mongodb instance and the pacman webapp as two container images running in the same pod.

Go to `http://localhost:8000/` to see if you get the Pac-Man game.

Once you're satisfied you can push the image to the container registry.

```
podman push <registry>/<user>/pacman-nodejs-app
```

### Building using an s2i image

```
s2i build . ubi9/nodejs-18-minimal pacman
```

## Credentials

Originally written by [platzh1rsch](http://platzh1rsch.ch) and modified by [Ivan Font](http://ivanfont.com). 
You can get the original code [here](https://github.com/platzhersh/pacman-canvas) 
or the original modified version [here](https://github.com/font/pacman).

NodeJS backend updated and refactored by François Charette ([this repo](https://github.com/fc7/pacman)).
