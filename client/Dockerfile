# Stage 1: build the React app into static files
FROM node:20-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: serve the built static files with a lightweight web server
# We don't need Node.js at all for this - nginx serving plain HTML/JS/CSS
# is smaller and faster than running a dev server in "production".
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
