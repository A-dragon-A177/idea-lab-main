const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log("=== DATABASE DEBUG ===\n");

    // 1. Check ALL embeddings (active + inactive)
    const { count: totalEmbeddings } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true });
    console.log(`Total embeddings in DB (all): ${totalEmbeddings}`);

    const { count: activeEmbeddings } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
    console.log(`Total ACTIVE embeddings in DB: ${activeEmbeddings}`);

    // 2. Check embeddings per project
    const { data: projectEmbs } = await supabase
        .from('project_embeddings')
        .select('project_id')
        .eq('is_active', true);
    
    if (projectEmbs && projectEmbs.length > 0) {
        const perProject = {};
        projectEmbs.forEach(r => { perProject[r.project_id] = (perProject[r.project_id] || 0) + 1; });
        console.log("\nActive embeddings per project:");
        Object.entries(perProject).forEach(([pid, count]) => console.log(`  ${pid}: ${count} chunks`));
    } else {
        console.log("\nNo active embeddings for any project.");
    }

    // 3. Check documents table
    const { data: docs, error: docErr } = await supabase
        .from('documents')
        .select('id, project_id, original_filename, is_active, version, content')
        .eq('is_active', true)
        .limit(20);

    if (docErr) {
        console.log(`\nError fetching documents: ${docErr.message}`);
    } else {
        console.log(`\nActive documents in database: ${docs?.length || 0}`);
        if (docs) {
            docs.forEach(d => {
                const contentLen = d.content ? d.content.length : 0;
                console.log(`  [${d.project_id}] "${d.original_filename}" v${d.version} - content: ${contentLen} chars`);
            });
        }
    }

    // 4. Check specifically for project 38f36368
    const targetProject = '38f36368-abdf-4f4e-9013-811b6f707dff';
    const { data: targetDocs } = await supabase
        .from('documents')
        .select('id, original_filename, content, version')
        .eq('project_id', targetProject)
        .eq('is_active', true);

    console.log(`\n=== Target Project ${targetProject} ===`);
    console.log(`Documents: ${targetDocs?.length || 0}`);
    if (targetDocs) {
        for (const d of targetDocs) {
            const contentLen = d.content ? d.content.length : 0;
            const preview = d.content ? d.content.substring(0, 200) : '(empty)';
            console.log(`  File: "${d.original_filename}" v${d.version}`);
            console.log(`  Content length: ${contentLen} chars`);
            console.log(`  Preview: ${preview}`);
            console.log('---');
        }
    }

    // 5. Check for ANY embeddings (including inactive) for this project
    const { count: targetTotal } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', targetProject);
    console.log(`\nTotal embeddings (incl. inactive) for target project: ${targetTotal}`);

    const { count: targetActive } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', targetProject)
        .eq('is_active', true);
    console.log(`Active embeddings for target project: ${targetActive}`);
}

debug().catch(console.error);
