const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const projectId = '38f36368-abdf-4f4e-9013-811b6f707dff';
    const { data, error } = await supabase
        .from('project_embeddings')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No embeddings found.");
        return;
    }

    const row = data[0];
    console.log("Created At:", row.created_at);
    console.log("Text:", row.chunk_text.substring(0, 50));
    console.log("Vector type:", typeof row.embedding);
    console.log("Vector (first 100 chars):", JSON.stringify(row.embedding).substring(0, 100));
}

check();
