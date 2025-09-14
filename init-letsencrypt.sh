#!/bin/bash

# Let's Encrypt 初始化腳本
# 使用前請先修改 docker-compose.yml 中的 email 地址

domains=(luftdeck.sololin.xyz)
rsa_key_size=4096
data_path="./ssl"
email="your-email@example.com" # 請替換為你的真實郵箱
staging=0 # 設為 1 用於測試，設為 0 用於生產

if [ -d "$data_path" ]; then
  read -p "現有數據目錄 $data_path 已存在，是否繼續？(y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### 下載推薦的 TLS 參數 ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### 創建虛擬網絡（如果不存在）..."
docker network create nginx-proxy 2>/dev/null || true

echo "### 啟動 nginx ..."
docker-compose up --force-recreate -d nginx
echo

echo "### 刪除舊證書（如果存在）..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### 請求 Let's Encrypt 證書..."
# 選擇 staging 或 production
if [ $staging != "0" ]; then staging_arg="--staging"; fi

# 加入所有域名
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# 選擇 email
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# 啟用 staging 模式（如果需要）
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### 重啟 nginx ..."
docker-compose exec nginx nginx -s reload
echo

echo "### 完成！"
echo "你的網站現在應該可以通過 https://$domains 訪問了"
