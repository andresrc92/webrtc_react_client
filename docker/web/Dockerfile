FROM node:20-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm install

COPY . .

# Vite inlines VITE_* vars at build time, so the target Isaac Sim/proxy
# address has to be baked in here rather than supplied at container runtime.
ARG VITE_ISAAC_SIM_SERVER
ARG VITE_ISAAC_SIM_SIGNAL_PORT=49100
ARG VITE_ISAAC_SIM_MEDIA_PORT=47998
ARG VITE_SIGNALING_SERVER
ARG VITE_SIGNALING_PATH
ARG VITE_FORCE_WSS
ENV VITE_ISAAC_SIM_SERVER=$VITE_ISAAC_SIM_SERVER \
    VITE_ISAAC_SIM_SIGNAL_PORT=$VITE_ISAAC_SIM_SIGNAL_PORT \
    VITE_ISAAC_SIM_MEDIA_PORT=$VITE_ISAAC_SIM_MEDIA_PORT \
    VITE_SIGNALING_SERVER=$VITE_SIGNALING_SERVER \
    VITE_SIGNALING_PATH=$VITE_SIGNALING_PATH \
    VITE_FORCE_WSS=$VITE_FORCE_WSS

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
