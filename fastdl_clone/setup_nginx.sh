#!/bin/bash

# Configuration
VPS_IP=$(curl -s https://ifconfig.me)  # Automatically detects public IP
PROJECT_DIR="$(pwd)"

# Detect PHP version
PHP_VERSION=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
PHP_FPM_SOCK="/var/run/php/php${PHP_VERSION}-fpm.sock"

echo " Detected IP: $VPS_IP"
echo " Detected PHP: $PHP_VERSION"
echo " Project Dir: $PROJECT_DIR"

# Create the Nginx Configuration
cat <<EOF > /etc/nginx/sites-available/instaminsta
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name 72.62.228.105 $VPS_IP _;

    root /var/www/html;
    index index.php index.html index.htm;

    # 1. Main App (Frontend)
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # 2. Blog (WordPress)
    location /blog {
        alias /var/www/html/blog;
        try_files \$uri \$uri/ @blog;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:$PHP_FPM_SOCK;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
        }
    }

    location @blog {
        rewrite /blog/(.*)$ /blog/index.php?/\$1 last;
    }

    # 3. API Proxy (Backend)
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/instaminsta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and Restart
nginx -t && systemctl restart nginx

echo "✅ Nginx has been configured and restarted!"
echo "📍 Your site should be live at: http://$VPS_IP"
echo "📖 Your blog should be live at: http://$VPS_IP/blog"
