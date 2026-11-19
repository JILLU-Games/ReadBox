server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}

upstream readbox_web {
    server 127.0.0.1:3000 fail_timeout=0;
}

server {
    listen 80;
    listen [::]:80;
    server_name {{APP_HOSTNAME}};
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        alias /var/www/letsencrypt/.well-known/acme-challenge/;
        default_type text/plain;
        access_log off;
    }

    location ~ /\.(?!well-known/) { return 404; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {{APP_HOSTNAME}};

    ssl_certificate /etc/letsencrypt/live/{{CERT_NAME}}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{CERT_NAME}}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:READBOXTLS:10m;
    ssl_session_tickets off;

    client_max_body_size 10m;
    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    access_log /var/log/readbox/nginx-access.log;
    error_log /var/log/readbox/nginx-error.log warn;

    location ~ /\.(?!well-known/) { return 404; }

    location /_protected_attachments/ {
        internal;
        alias /var/lib/readbox/attachments/;
        default_type application/octet-stream;
        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control "private, no-store" always;
    }

    location = /health/ready {
        allow 127.0.0.1;
        allow ::1;
        deny all;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://readbox_web;
    }

    location = /health/ready/ {
        allow 127.0.0.1;
        allow ::1;
        deny all;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://readbox_web;
    }

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
        proxy_read_timeout 60s;
        proxy_pass http://readbox_web;
    }
}
