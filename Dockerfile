FROM nginxinc/nginx-unprivileged:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

# Skip image templating scripts: the checked-in configuration is ready to use.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
