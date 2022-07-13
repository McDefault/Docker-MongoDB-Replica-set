FROM mongo:4.2.8

COPY entry.js /docker-entrypoint-initdb.d/
