FROM nginx:stable-alpine
RUN apk add --no-cache nodejs
WORKDIR /app
COPY generate.mjs nginx.conf.template ./
COPY start-generator.sh /docker-entrypoint.d/05-generate-web-config.sh
RUN chmod +x /docker-entrypoint.d/05-generate-web-config.sh
