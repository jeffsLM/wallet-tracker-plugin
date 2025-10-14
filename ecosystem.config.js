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
        NODE_ENV: "production"
      }
    }
  ]
};
