FROM node:20 as builder

WORKDIR /cloudinary-script

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install

COPY . .

RUN pnpm run build || (echo "Build failed, reviewing available files:" && ls -la && false)

CMD [ "node", "dist/index.js" ]
