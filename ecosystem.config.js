module.exports = {
  apps: [
    {
      name: 'lanka-offers-api',
      script: 'dist/app/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env_file: '.env',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
