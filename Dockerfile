# Root Dockerfile for Hugging Face Spaces compatibility
FROM node:18

WORKDIR /app

# Copy the server directory files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install

WORKDIR /app
COPY server/ ./server/
WORKDIR /app/server
RUN npm run build

EXPOSE 7860
ENV PORT=7860

CMD [ "npm", "start" ]
