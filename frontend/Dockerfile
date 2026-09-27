FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY tsconfig.base.json ./
COPY shared shared
COPY frontend frontend
# Baked into the static build; set for the dev instance so it shows a banner.
ARG INSTANCE_LABEL=""
ENV VITE_INSTANCE_LABEL=$INSTANCE_LABEL
RUN npm run build -w frontend

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
