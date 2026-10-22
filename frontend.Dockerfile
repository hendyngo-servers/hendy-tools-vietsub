FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
COPY index.html ./index.html
COPY assets ./assets
COPY src ./src
COPY manifest.webmanifest ./manifest.webmanifest
COPY sw.js ./sw.js
EXPOSE 80
