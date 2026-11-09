# @tdn/hub — «Хаб» (shell, host микрофронтендов)
# Сборка из КОРНЯ монорепо (context: ../..), т.к. приложение зависит от packages/shared.
#   docker build -f apps/hub/Dockerfile -t tdn-hub .
#
# Хаб — host: объявляет remotes (campaign, game-systems, profile, login).
# URL их remoteEntry.js задаются на этапе сборки через build-args VITE_REMOTE_*.
# ВАЖНО: build-arg сам по себе НЕ становится переменной окружения — нужен явный
# ENV VITE_REMOTE_X=$VITE_REMOTE_X, иначе process.env в vite.config пуст и берётся
# фолбэк localhost:3000-3003.
#
# Базовый путь: по умолчанию '/' (отдельный поддомен). Для деплоя под путём
# (например /hub) передайте --build-arg VITE_BASE=/hub.

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

# Базовый путь
ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE

# URL remotes (remoteEntry.js каждого приложения)
ARG VITE_REMOTE_CAMPAIGN=http://localhost:3000/assets/remoteEntry.js
ARG VITE_REMOTE_GAME_SYSTEMS=http://localhost:3001/assets/remoteEntry.js
ARG VITE_REMOTE_PROFILE=http://localhost:3002/assets/remoteEntry.js
ARG VITE_REMOTE_LOGIN=http://localhost:3003/assets/remoteEntry.js
ENV VITE_REMOTE_CAMPAIGN=$VITE_REMOTE_CAMPAIGN
ENV VITE_REMOTE_GAME_SYSTEMS=$VITE_REMOTE_GAME_SYSTEMS
ENV VITE_REMOTE_PROFILE=$VITE_REMOTE_PROFILE
ENV VITE_REMOTE_LOGIN=$VITE_REMOTE_LOGIN

RUN npm run build --workspace @tdn/hub

FROM node:lts-alpine

WORKDIR /app
COPY --from=builder /usr/src/app/apps/hub/build ./build
COPY apps/hub/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && npm install -g serve

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["serve", "-s", "build", "-l", "3000"]
