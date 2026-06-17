# syntax=docker/dockerfile:1
# Build context: raiz del ecosistema (../ desde arellan-infrastructure)
# Necesario para resolver la dependencia file: a @arellan-hnos-core-ecosystem/ui
# y los overrides de eslint-config/typescript-config (workspace:* neutralizado)

# ---------- Stage 1: builder ----------
FROM node:24-alpine AS builder
WORKDIR /workspace

COPY arellan-mechanic-ui/package.json arellan-mechanic-ui/package-lock.json ./arellan-mechanic-ui/
COPY arellan-design-system/packages/ui ./arellan-design-system/packages/ui
COPY arellan-design-system/packages/eslint-config ./arellan-design-system/packages/eslint-config
COPY arellan-design-system/packages/typescript-config ./arellan-design-system/packages/typescript-config

# Deps runtime del paquete ui (class-variance-authority/clsx/tailwind-merge):
# npm NO instala dependencias de paquetes file:-linkeados y el .dockerignore
# excluye node_modules, asi que se materializan aqui. Se eliminan las
# devDependencies primero porque usan protocolo workspace:* (no soportado por npm).
WORKDIR /workspace/arellan-design-system/packages/ui
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.devDependencies;fs.writeFileSync('package.json',JSON.stringify(p,null,2))" \
 && npm install --omit=dev --no-audit --no-fund

WORKDIR /workspace/arellan-mechanic-ui
# react/react-dom y @types/react del ui se symlinkean a las copias del app:
# una unica instancia de tipos (evita "ReactNode is not assignable" por @types
# duplicados) y un unico runtime de react en el bundle.
RUN npm install --no-audit --no-fund \
 && UI=/workspace/arellan-design-system/packages/ui/node_modules \
 && rm -rf $UI/react $UI/react-dom $UI/@types/react $UI/@types/react-dom \
 && mkdir -p $UI/@types \
 && ln -s /workspace/arellan-mechanic-ui/node_modules/react $UI/react \
 && ln -s /workspace/arellan-mechanic-ui/node_modules/react-dom $UI/react-dom \
 && ln -s /workspace/arellan-mechanic-ui/node_modules/@types/react $UI/@types/react \
 && ln -s /workspace/arellan-mechanic-ui/node_modules/@types/react-dom $UI/@types/react-dom

COPY arellan-mechanic-ui/. .
RUN npm run build

# ---------- Stage 2: runner ----------
FROM node:24-alpine AS runner
WORKDIR /workspace/arellan-mechanic-ui
ENV NODE_ENV=production

RUN npm install --global serve@14 --no-audit --no-fund

COPY --from=builder /workspace/arellan-mechanic-ui/dist ./dist

EXPOSE 3003
CMD ["serve", "-s", "dist", "-l", "3003"]
