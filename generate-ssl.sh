#!/bin/bash

# 生成自簽 SSL 證書腳本
echo "正在生成 SSL 證書..."

# 檢查 ssl 目錄是否存在
if [ ! -d "ssl" ]; then
    mkdir -p ssl
fi

# 生成私鑰和證書
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=TW/ST=Taiwan/L=Taipei/O=Luftdeck/OU=Backend/CN=localhost"

echo "SSL 證書已生成到 ssl/ 目錄"
echo "證書文件: ssl/cert.pem"
echo "私鑰文件: ssl/key.pem"
echo ""
echo "注意: 這是自簽證書，瀏覽器會顯示安全警告"
echo "生產環境請使用正式的 SSL 證書"
