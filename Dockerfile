FROM nginx:alpine

COPY index.html styles.css app.js /usr/share/nginx/html/
COPY imgs/ /usr/share/nginx/html/imgs/

EXPOSE 80
