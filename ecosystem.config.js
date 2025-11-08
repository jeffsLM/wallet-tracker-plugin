module.exports = {
  apps: [
    {
      name: "wallet-tracker-plugin",
      script: "dist/index.js",
      cwd: "/home/ec2-user/wallet-tracker-plugin",
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
      cwd: "/home/ec2-user/wallet-tracker-plugin",
      autorestart: true,
      cron_restart: "0 */6 * * *", // limpa a cada 6 horas
      watch: false,
    },
  ],
};
