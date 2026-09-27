FROM node:22-slim

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=4317
EXPOSE 4317

# Persist the SQLite file outside the container image.
VOLUME ["/app/data"]

CMD ["node", "server.mjs"]
