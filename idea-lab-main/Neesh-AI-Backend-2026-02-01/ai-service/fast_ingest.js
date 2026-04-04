const http = require('http');

const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';

async function ingestNow(pid) {
    console.log(`[FastIngest] Triggering ingestion for project: ${pid}`);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/internal/ingest/${pid}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': 'neesh-ai-secret-key-123',
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[FastIngest] SUCCESS (HTTP 200)`);
                    resolve(true);
                } else {
                    console.error(`[FastIngest] FAILED (HTTP ${res.statusCode}): ${data}`);
                    resolve(false);
                }
            });
        });
        req.on('error', (e) => {
            console.error(`[FastIngest] ERROR: ${e.message}`);
            resolve(false);
        });
        req.end();
    });
}

ingestNow(projectId);
