const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const projectId = '38f36368-abdf-4f4e-9013-811b6f707dff';
    const { count, error } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('is_active', true);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Project ${projectId} has ${count} active embeddings.`);
}

check();
