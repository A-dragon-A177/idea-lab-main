// Trigger re-ingestion for all projects that have documents with content
const http = require('http');

const projectIds = [
    'c7e3f37b-90fe-4d68-a2a7-bca5d2800f27',  // Ai Idea Validation Framework (10045 chars)
    'b965337d-1080-4e4c-8932-e329956b7ea0',  // TrustLayer AI (3331 chars)
    'dac6b850-89e8-472b-891d-8568a0c575c8',  // Byju preparation (37622 chars)
];

async function ingest(projectId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/internal/ingest/${projectId}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': 'neesh-ai-secret-key-123',
            }
        };

        console.log(`[Ingest] Starting ingestion for project ${projectId}...`);
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[Ingest] Status: ${res.statusCode}, Response: ${data}`);
                resolve(data);
            });
        });

        req.on('error', (e) => {
            console.error(`[Ingest] Error: ${e.message}`);
            reject(e);
        });

        req.end();
    });
}

async function main() {
    for (const pid of projectIds) {
        try {
            await ingest(pid);
            console.log(`[Ingest] ✅ Done: ${pid}\n`);
        } catch (e) {
            console.log(`[Ingest] ❌ Failed: ${pid}\n`);
        }
        // Wait between projects to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("[Ingest] All projects re-ingested!");
}

main();
