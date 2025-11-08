#!/bin/bash

LOG_PATH="/home/ec2-user/.pm2/logs"
MAX_DAYS=2

echo "🧹 Limpando logs PM2 com mais de $MAX_DAYS dias..."
find "$LOG_PATH" -type f -mtime +$MAX_DAYS -name "*.log" -exec rm -f {} \;
echo "✅ Logs antigos removidos com sucesso."
