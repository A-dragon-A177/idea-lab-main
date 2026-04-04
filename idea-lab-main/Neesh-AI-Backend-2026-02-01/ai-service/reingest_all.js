const { createClient } = require('@supabase/supabase-js');
const http = require('http');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function main() {
    const { data: docs } = await supabase
        .from('documents')
        .select('project_id, content')
        .eq('is_active', true);

    const projectIds = new Set();
    for (const doc of docs) {
        if (doc.content && doc.content.length > 0) {
            projectIds.add(doc.project_id);
        }
    }

    console.log(`Found ${projectIds.size} projects with text content to re-ingest.`);

    for (const pid of projectIds) {
        try {
            await ingest(pid);
        } catch (e) {
            console.log(`[Ingest] Failed for ${pid}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // Validate number of embeddings
    const { data: embeds } = await supabase
        .from('project_embeddings')
        .select('id, project_id')
        .eq('is_active', true);
        
    console.log(`\n=== Total Embeddings After Ingestion: ${embeds ? embeds.length : 0} ===`);
}

main().catch(console.error);
