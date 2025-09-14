#!/bin/bash

# Let's Encrypt 證書自動更新腳本

echo "### 更新 Let's Encrypt 證書..."

# 更新證書
docker-compose run --rm --entrypoint "\
  certbot renew --webroot -w /var/www/certbot" certbot

# 重新載入 nginx 配置
docker-compose exec nginx nginx -s reload

echo "### 證書更新完成！"
