module.exports = {
  apps: [
    {
      name: "wallet-tracker-plugin",
      script: "dist/index.js",
      cwd: "/home/ubuntu/projects/wallet-tracker-plugin",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      // Rotação de logs automática (via PM2 Log Rotate)
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "log-cleaner",
      script: "./scripts/clean-logs.sh",
      cwd: "/home/ubuntu/projects/wallet-tracker-plugin",
      autorestart: false,              // ❌ não reinicia automaticamente
      cron_restart: "0 0 * * *",       // 🕛 roda 1x por dia à meia-noite
      watch: false
    }
  ],
};
