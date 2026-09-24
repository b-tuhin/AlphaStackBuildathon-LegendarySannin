FROM node:20-alpine

RUN apk add --no-cache python3 make g++ wget

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
RUN mkdir -p /app/data

EXPOSE 4000 2525
CMD ["node", "src/index.js"]
