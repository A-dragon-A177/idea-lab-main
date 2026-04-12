/**
 * PM2 Ecosystem Configuration for Neesh AI Service
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js   (zero-downtime restart)
 *   pm2 stop ai-service
 *   pm2 logs ai-service
 * 
 * Cluster mode spawns one worker per CPU core, allowing
 * the single-threaded Node.js event loop to handle 4-8x
 * more concurrent requests on a multi-core machine.
 */
module.exports = {
    apps: [{
        name: 'ai-service',
        script: 'dist/index.js',
        instances: 1,           // Single instance — cluster mode caused EADDRINUSE on 127.0.0.1:3000
        exec_mode: 'fork',      // Fork mode is safe; cluster requires 0.0.0.0 binding
        max_memory_restart: '500M',
        kill_timeout: 5000,     // Wait 5s for graceful shutdown before SIGKILL
        listen_timeout: 10000,  // Wait 10s for app to bind port before marking errored
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        // Logging
        error_file: './logs/error.log',
        out_file: './logs/output.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        // Restart policy
        max_restarts: 10,
        restart_delay: 3000,
        autorestart: true,
        watch: false
    }]
};

