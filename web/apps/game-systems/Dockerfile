# @tdn/game-systems — «Игровые системы» (системы, контент, версии, правила)
# Сборка из КОРНЯ монорепо (context: ../..), т.к. приложение зависит от packages/shared.
#   docker build -f apps/game-systems/Dockerfile -t tdn-game-systems .
# Базовый путь: по умолчанию '/' (отдельный поддомен). Для деплоя под путём
# (например /game-systems) передайте --build-arg VITE_BASE=/game-systems.

FROM node:20 AS builder
WORKDIR /usr/src/app

# Копируем манифесты корня и всех workspaces для кэширования слоя npm ci
COPY package.json package-lock.json ./
COPY apps/campaign/package.json apps/campaign/package.json
COPY apps/game-systems/package.json apps/game-systems/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# Исходники (включая packages/shared, от которого зависит приложение)
COPY . .

ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
RUN npm run build --workspace @tdn/game-systems

FROM node:lts-alpine

WORKDIR /app
COPY --from=builder /usr/src/app/apps/game-systems/build ./build
COPY apps/game-systems/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && npm install -g serve

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["serve", "-s", "build", "-l", "3000"]
