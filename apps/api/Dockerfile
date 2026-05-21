FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run db:generate --workspace=apps/api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma
COPY --from=build /app/packages/shared/dist packages/shared/dist
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
