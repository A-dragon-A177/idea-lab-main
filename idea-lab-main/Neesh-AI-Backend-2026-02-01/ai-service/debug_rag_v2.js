const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProject(pid) {
    console.log(`=== Debugging Project: ${pid} ===`);
    
    // 1. Check if project exists
    const { data: project, error: pErr } = await supabase.from('projects').select('*').eq('id', pid).single();
    if (pErr) console.log(`Project ${pid} NOT FOUND in 'projects' table: ${pErr.message}`);
    else console.log(`Project exists: ${project.name}`);

    // 2. Check documents
    const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('id, original_filename, is_active, content, version')
        .eq('project_id', pid);
        
    if (docError) {
        console.error("Doc Error:", docError);
    } else {
        console.log(`Found ${docs.length} documents in 'documents' table.`);
        docs.forEach(d => {
            console.log(`- DocID: ${d.id}, File: ${d.original_filename}, Active: ${d.is_active}, ContentLen: ${d.content?.length || 0}`);
        });
    }

    // 3. Check embeddings
    const { count, error: countError } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', pid);

    if (countError) {
        console.error("Embedding Error:", countError);
    } else {
        console.log(`Found ${count} active embeddings in 'project_embeddings'.`);
    }
}

checkProject('b965337d-1080-4e4c-8932-e329956b7ea0');
