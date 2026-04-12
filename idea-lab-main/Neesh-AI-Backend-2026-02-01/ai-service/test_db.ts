import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

async function check() {
  const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';
  
  // 1. Check how many chunks exist for this project
  const { count, error: countErr } = await supabase
    .from('project_embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
    
  console.log(`Total chunks for project: ${count}`);
  if (countErr) console.error(countErr);

  // 2. Try to search for "financial"
  const { data: chunks, error } = await supabase
    .from('project_embeddings')
    .select('chunk_text')
    .eq('project_id', projectId)
    .ilike('chunk_text', '%financial%');

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log(`Found ${chunks.length} chunks containing "financial".`);
    if (chunks.length > 0) {
      console.log("First chunk snippet:", chunks[0].chunk_text.substring(0, 100) + "...");
    }
  }

  // 3. Let's see what documents exist for this project
  const { data: docs } = await supabase
    .from('documents')
    .select('id, original_filename, is_active')
    .eq('project_id', projectId);
    
  console.log("Documents in DB for this project:", docs);
}

check();
