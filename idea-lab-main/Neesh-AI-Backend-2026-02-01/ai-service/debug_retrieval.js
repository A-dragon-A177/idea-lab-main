const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';

async function testRetrieval() {
    console.log("=== Debug Retrieval ===");
    
    // 1. Generate query embedding
    const query = 'Summarize this blog';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${process.env.GEMINI_API_KEY}`;
    console.log("Generating embedding for query...");
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'models/gemini-embedding-2-preview',
            outputDimensionality: 768,
            content: { parts: [{ text: query }] }
        })
    });
    const embData = await resp.json();
    const queryEmbedding = embData.embedding?.values;
    console.log(`Query embedding dimensions: ${queryEmbedding?.length}`);
    
    // 2. Perform vector search matching RPC
    console.log("\nCalling match_project_embeddings RPC...");
    const matchLimit = 5;
    const similarityThreshold = 0.5;
    
    const { data: results, error: matchError } = await supabase.rpc('match_project_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: similarityThreshold,
        match_count: matchLimit,
        filter_project_id: projectId
    });
    
    if (matchError) {
        console.error("Match Error:", matchError);
    } else {
        console.log(`Matched ${results?.length || 0} chunks.`);
        if (results && results.length > 0) {
            results.forEach((r, i) => {
                console.log(`Match ${i+1} (similarity: ${r.similarity}): ${r.chunk_text.substring(0, 50)}...`);
            });
        }
    }
}

testRetrieval();
