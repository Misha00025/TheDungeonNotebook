# @tdn/campaign — «Кампания» (группы, персонажи, игра)
# Сборка из КОРНЯ монорепо (context: ../..), т.к. приложение зависит от packages/shared.
#   docker build -f apps/campaign/Dockerfile -t tdn-campaign .
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

RUN npm run build --workspace @tdn/campaign

FROM node:lts-alpine

WORKDIR /app
COPY --from=builder /usr/src/app/apps/campaign/build ./build
RUN npm install -g serve

CMD ["serve", "build", "-l", "3000", "--cors"]
