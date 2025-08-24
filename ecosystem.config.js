module.exports = {
  apps: [
    {
      name: "whatsapp-processor",
      script: "dist/index.js",
      cwd: "/home/ec2-user/whatsapp-processor",
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
