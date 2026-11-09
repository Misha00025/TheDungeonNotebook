# @tdn/login — «Вход» (remote-приложение микрофронтендов)
# Сборка из КОРНЯ монорепо (context: .), т.к. приложение зависит от packages/shared.
#   docker build -f apps/login/Dockerfile -t tdn-login .
# Базовый путь: по умолчанию '/' (отдельный поддомен). Для деплоя под путём
# (например /apps/login) передайте --build-arg VITE_BASE=/apps/login.

FROM node:20 AS builder
WORKDIR /usr/src/app

# Копируем манифесты корня и всех workspaces для кэширования слоя npm ci
COPY package.json package-lock.json ./
COPY apps/hub/package.json apps/hub/package.json
COPY apps/campaign/package.json apps/campaign/package.json
COPY apps/game-systems/package.json apps/game-systems/package.json
COPY apps/profile/package.json apps/profile/package.json
COPY apps/login/package.json apps/login/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# Исходники (включая packages/shared, от которого зависит приложение)
COPY . .

ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
RUN npm run build --workspace @tdn/login

FROM node:lts-alpine

WORKDIR /app
COPY --from=builder /usr/src/app/apps/login/build ./build
COPY apps/login/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && npm install -g serve

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["serve", "-s", "build", "-l", "3000"]
