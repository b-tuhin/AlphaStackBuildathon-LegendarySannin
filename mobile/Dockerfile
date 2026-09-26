FROM node:20-bullseye

WORKDIR /app
COPY package.json ./
RUN npm install

COPY . .

ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
EXPOSE 8081 19000 19001 19002

CMD ["npx", "expo", "start", "--host", "lan", "--port", "8081"]
