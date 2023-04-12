# Pull node.js image
FROM node:16-alpine as build
WORKDIR /app
# Install npm packages and cache this layer
COPY ./package*.json /app/
RUN npm install
# Build copy all source files and build React app
COPY ./ /app/
COPY ./deployment/react.env /app/.env

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Pull NGINX image
FROM nginx:1.15
# Move all build files to NGINX serve folder
COPY --from=build /app/build/ /usr/share/nginx/html
# Setup NGINX with config
COPY ./deployment/frontend/nginx.conf /etc/nginx/conf.d/default.conf
