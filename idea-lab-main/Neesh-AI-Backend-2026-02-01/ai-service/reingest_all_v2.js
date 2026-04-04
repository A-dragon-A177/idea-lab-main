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

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[Ingest] Success for ${projectId} (HTTP 200)`);
                    resolve(true);
                } else {
                    console.error(`[Ingest] FAILED for ${projectId} (HTTP ${res.statusCode}): ${data}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`[Ingest] Error for ${projectId}: ${e.message}`);
            resolve(false);
        });
        req.end();
    });
}

async function main() {
    console.log("=== Staring Bullletproof Re-Sync v2 (with cleanup) ===");
    
    // Fetch all unique project IDs that have active documents
    const { data: docs, error } = await supabase
        .from('documents')
        .select('project_id, original_filename')
        .eq('is_active', true);

    if (error) {
        console.error("Failed to fetch documents from Supabase:", error.message);
        process.exit(1);
    }

    const projectIds = [...new Set(docs.map(d => d.project_id))];
    console.log(`Found ${projectIds.length} unique projects to re-ingest.`);

    let successCount = 0;
    for (let i = 0; i < projectIds.length; i++) {
        const pid = projectIds[i];
        console.log(`\n[${i+1}/${projectIds.length}] Project ${pid}`);
        
        const success = await ingest(pid);
        if (success) successCount++;
        
        // Wait between projects to avoid rate limits (Increased to 5s)
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`\n=== Re-Sync Complete: ${successCount}/${projectIds.length} projects succeeded ===`);
    
    // Check final counts in DB
    const { count } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
        
    console.log(`Total active embeddings in DB now: ${count}`);
}

main().catch(console.error);
