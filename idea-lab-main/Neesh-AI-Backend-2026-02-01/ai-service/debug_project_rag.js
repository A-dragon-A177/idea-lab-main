const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProject(pid) {
    console.log(`Checking project: ${pid}`);
    
    const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('id, original_filename, is_active, content, version')
        .eq('project_id', pid);
        
    if (docError) {
        console.error("Doc Error:", docError);
    } else {
        console.log(`Found ${docs.length} documents.`);
        docs.forEach(d => {
            console.log(`- ${d.original_filename} (v${d.version}) active=${d.is_active} contentLen=${d.content?.length || 0}`);
        });
    }

    const { count, error: countError } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', pid);

    if (countError) {
        console.error("Embedding Error:", countError);
    } else {
        console.log(`Found ${count} active embeddings for project.`);
    }
}

checkProject('b965337d-1080-4e4c-8932-e329956b7ea0');
