// Check what projects have documents in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // Check documents table
    const { data: docs, error: docsErr } = await supabase
        .from('documents')
        .select('project_id, original_filename, is_active, version, content')
        .eq('is_active', true)
        .limit(10);

    if (docsErr) {
        console.log("Error fetching docs:", docsErr.message);
    } else {
        console.log(`\n=== Active Documents (${docs.length}) ===`);
        for (const doc of docs) {
            const contentLen = doc.content ? doc.content.length : 0;
            console.log(`  Project: ${doc.project_id}`);
            console.log(`    File: ${doc.original_filename} (v${doc.version})`);
            console.log(`    Content: ${contentLen} chars`);
            if (contentLen > 0) {
                console.log(`    Preview: ${doc.content.substring(0, 100)}...`);
            }
            console.log();
        }
    }

    // Check existing embeddings
    const { data: embeds, error: embedsErr } = await supabase
        .from('project_embeddings')
        .select('project_id, is_active, source_type')
        .eq('is_active', true)
        .limit(5);

    if (embedsErr) {
        console.log("Error fetching embeddings:", embedsErr.message);
    } else {
        console.log(`=== Active Embeddings: ${embeds.length} ===`);
        for (const e of embeds) {
            console.log(`  Project: ${e.project_id}, Source: ${e.source_type}`);
        }
    }
}

check().catch(e => console.error("Error:", e));
