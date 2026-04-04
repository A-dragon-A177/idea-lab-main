const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .order('last_asked_at', { ascending: false, nullsFirst: false })
        .limit(5);

    if (error) {
        console.log("Error querying by last_asked_at, trying id...");
        const { data: q2 } = await supabase.from('questions').select('*').order('id', { ascending: false }).limit(5);
        if (q2) printQ(q2);
    } else {
        printQ(questions);
    }

    async function printQ(qs) {
        console.log("=== Recent Questions ===");
        for (const q of qs) {
            console.log(`Time: ${q.last_asked_at || 'unknown'}`);
            console.log(`Project: ${q.project_id}`);
            console.log(`Q: ${q.question_text}`);
            
            const { data: embeds } = await supabase
                .from('project_embeddings')
                .select('id')
                .eq('project_id', q.project_id)
                .limit(1);
                
            console.log(`Embeddings exist for project: ${embeds && embeds.length > 0 ? "YES" : "NO"}`);
            
            const { data: docs } = await supabase
                .from('documents')
                .select('id, is_active')
                .eq('project_id', q.project_id)
                .limit(1);
                
            console.log(`Active documents exist for project: ${docs && docs.length > 0 ? "YES" : "NO"}`);
            console.log("------------------------");
        }
    }
}
check();
