// PM2 process definition for the Skyfield web PWA.
// Serves the built dist/ via the zero-dependency server.js. Behind nginx,
// proxy your domain (e.g. skyfield.atsumilabs.com) to PORT.
//
//   pm2 start ecosystem.config.cjs       # first time
//   pm2 reload ecosystem.config.cjs      # zero-downtime reload (used by CI)
module.exports = {
  apps: [
    {
      name: "skyfield",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
        // 8123 is tadkaplay; point nginx for Skyfield's domain here.
        PORT: 8125,
      },
    },
  ],
};
