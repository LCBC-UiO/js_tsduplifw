# TSD upload link forwarder

Forward PUT requests for TSD upload links.

## Quick start

  * clone the repo && cd js_tsduplifw
  * create a file `.env` to make your config (use `cp .env_example .env` to get started)
  * `npm install`
  * `node srv.js`


To upload a file use PUT
```
curl -X PUT --data-binary @./foo/bigfile.bar "https://replace.me/tsduplifw/upload?filename=foo/bigfile.bar&bucket=bucket1"
```
where
  * `filename` is a path 
  * `bucket` is a bucket ID defined in env


## Server setup

Starting from a Debian 10 base

```

server_name=replace.me

#------------------------------------------------------------------------------

# install packages

sudo apt-get update && DEBIAN_FRONTEND=noninteractive sudo apt-get install -y \
  bash-completion \
  git \
  netcat-traditional \
  locales \
  nodejs \
  npm \
  nginx \
  certbot \
  python-certbot-nginx

#------------------------------------------------------------------------------


# configure webserver

sudo tee /etc/nginx/sites-available/default << EOI
server {
  root /var/www/html;
  server_name ${server_name};
  location  ~ ^/tsduplifw/(.*)$ {
    proxy_pass http://127.0.0.1:45585/$1$is_args$args;
    proxy_request_buffering off;
  }
}
EOI

# set "client_max_body_size 1G;" in http section of /etc/nginx/nginx.conf

sudo service nginx restart


#------------------------------------------------------------------------------


# configure SSL

sudo certbot --nginx -d ${server_name} -m flo.krull@gmail.com

#------------------------------------------------------------------------------


# install pm2

sudo npm install pm2 -g
# from "pm2 startup":
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u debian --hp /home/debian

#------------------------------------------------------------------------------


# install tsduplifw

git clone https://github.com/LCBC-UiO/js_tsduplifw
cd js_tsduplifw
npm install
pm2 delete all || true
pm2 start srv.js --name tsduplifw
pm2 cleardump
pm2 save
```
