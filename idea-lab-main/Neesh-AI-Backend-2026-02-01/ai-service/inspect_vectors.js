const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkVectors() {
    const projectId = '38f36368-abdf-4f4e-9013-811b6f707dff';
    const { data, error } = await supabase
        .from('project_embeddings')
        .select('chunk_text, embedding')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No active embeddings found for this project.");
        return;
    }

    const row = data[0];
    console.log("Text snippet:", row.chunk_text.substring(0, 100));
    
    // row.embedding is likely a string or array depending on postgrest
    console.log("Embedding type:", typeof row.embedding);
    if (typeof row.embedding === 'string') {
        const v = JSON.parse(row.embedding.replace('{', '[').replace('}', ']'));
        console.log("Vector length:", v.length);
        console.log("First 10 values:", v.slice(0, 10));
    } else {
        console.log("Vector length:", row.embedding.length);
        console.log("First 10 values:", row.embedding.slice(0, 10));
    }
}

checkVectors().catch(console.error);
