#!/bin/bash
# Startet für die Tests: NAS-Nachbau (Port 8768) und davor das echte Hilfsprogramm nas/nginx.conf (Port 8767).
# Angepasst wird nur: Ziel = Nachbau statt NAS, App-Adresse = Testserver statt github.io.
# Ohne nginx (z.B. Cowork): Nachbau setzt die Freigabe selbst und läuft direkt auf 8767.
# Aufruf: bash tests/nas-proxy.sh start|stop
cd "$(dirname "$0")/.." || exit 1
D=/tmp/fp-nginx
if [ "$1" = stop ]; then
  [ -f $D/nginx.pid ] && kill "$(cat $D/nginx.pid)" 2>/dev/null
  [ -f /tmp/fp-nas.pid ] && kill "$(cat /tmp/fp-nas.pid)" 2>/dev/null
  rm -f /tmp/fp-nas.pid
  exit 0
fi
NGINX=$(command -v nginx || ls /usr/sbin/nginx 2>/dev/null)
if [ -n "$NGINX" ]; then
  node tests/mock-nas.mjs > /tmp/fp-nas.log 2>&1 &
  echo $! > /tmp/fp-nas.pid
  mkdir -p $D
  sed -e 's#https://nas:5001#http://127.0.0.1:8768#' -e '/proxy_ssl_verify/d' \
      -e 's#https://leibi-tech.github.io#http://localhost:8765#g' -e 's#listen 80;#listen 127.0.0.1:8767;#' \
      nas/nginx.conf > $D/site.conf
  cat > $D/nginx.conf <<CONF
worker_processes 1;
pid $D/nginx.pid;
error_log $D/error.log;
events { worker_connections 64; }
http {
  access_log off;
  client_body_temp_path $D/body;
  proxy_temp_path $D/proxy;
  fastcgi_temp_path $D/fcgi;
  uwsgi_temp_path $D/uwsgi;
  scgi_temp_path $D/scgi;
  include $D/site.conf;
}
CONF
  $NGINX -c $D/nginx.conf -e $D/error.log || { echo "nginx startet nicht"; exit 1; }
  echo "nginx"
else
  NAS_CORS=1 node tests/mock-nas.mjs > /tmp/fp-nas.log 2>&1 &
  echo $! > /tmp/fp-nas.pid
  echo "ohne-nginx"
fi
