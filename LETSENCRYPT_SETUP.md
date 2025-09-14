# Let's Encrypt SSL 設置指南

## 🚀 快速設置步驟

### 1. 修改配置
編輯 `docker-compose.yml`，將 email 替換為你的真實郵箱：
```yaml
command: certonly --webroot --webroot-path=/var/www/certbot --email YOUR_EMAIL@example.com --agree-tos --no-eff-email -d luftdeck.sololin.xyz
```

### 2. 確保域名指向正確
確保 `luftdeck.sololin.xyz` 的 DNS 記錄指向你的服務器 IP。

### 3. 初始化 Let's Encrypt
```bash
# 首次設置（測試模式）
./init-letsencrypt.sh

# 如果測試成功，修改 init-letsencrypt.sh 中的 staging=0，然後重新運行
```

### 4. 啟動服務
```bash
docker-compose up -d
```

## 🔄 自動更新設置

### 設置 cron 任務
```bash
# 編輯 crontab
crontab -e

# 添加以下行（記得修改路徑）
0 2 * * * cd /path/to/luftdeck-backend && ./renew-cert.sh >> /var/log/certbot-renew.log 2>&1
```

### 手動更新證書
```bash
./renew-cert.sh
```

## 📋 重要注意事項

1. **測試模式**: 首次運行建議使用 staging 模式測試
2. **DNS 設置**: 確保域名正確指向服務器
3. **防火牆**: 確保 80 和 443 端口開放
4. **Cloudflare**: 確保 Cloudflare 的 SSL/TLS 模式設置正確

## 🌐 訪問地址

- **主要網址**: `https://luftdeck.sololin.xyz/`
- **API 文檔**: `https://luftdeck.sololin.xyz/api-docs`
- **健康檢查**: `https://luftdeck.sololin.xyz/health`

## 🔧 故障排除

### 證書申請失敗
1. 檢查域名 DNS 設置
2. 確認 80 端口可訪問
3. 檢查防火牆設置
4. 查看 certbot 日誌

### 證書更新失敗
1. 檢查 cron 任務是否正確設置
2. 查看更新日誌
3. 手動運行更新腳本

## 📞 支援

如果遇到問題，請檢查：
- Docker 容器狀態: `docker-compose ps`
- Nginx 日誌: `docker-compose logs nginx`
- Certbot 日誌: `docker-compose logs certbot`
