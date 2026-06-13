module.exports = {
  apps: [
    {
      name: 'hk-automation-api',
      script: './backend/server.js',
      instances: 'max', // run in cluster mode matching CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        RUN_QUEUE_PROCESSORS: 'false' // disable processors on HTTP instances for scalability
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'hk-automation-worker',
      script: './backend/server.js',
      instances: 1, // run single background queue processor instance
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001, // run worker on a separate port
        RUN_QUEUE_PROCESSORS: 'true' // enable processors on the background node
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'hk-automation-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './frontend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
