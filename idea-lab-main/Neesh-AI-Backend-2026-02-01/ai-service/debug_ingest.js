/**
 * Direct ingestion test - bypasses HTTP to get the full error stack trace
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';

async function main() {
    console.log("=== Direct Ingestion Debug ===");
    
    // Step 1: Check documents for this project
    const { data: docs, error: docErr } = await supabase
        .from('documents')
        .select('id, original_filename, is_active, version, content, document_group_id')
        .eq('project_id', projectId)
        .eq('is_active', true);
    
    if (docErr) {
        console.error("Error fetching docs:", docErr.message);
        return;
    }
    
    console.log(`Found ${docs.length} active documents:`);
    for (const doc of docs) {
        console.log(`  - ${doc.original_filename} (v${doc.version}), groupId: ${doc.document_group_id}, contentLen: ${doc.content?.length || 0}`);
    }
    
    // Step 2: Check existing embeddings
    const { count: embBefore } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
    console.log(`\nEmbeddings BEFORE ingestion: ${embBefore}`);
    
    // Step 3: Delete existing embeddings (clean slate)
    console.log("\nDeleting existing embeddings...");
    const { error: delErr } = await supabase
        .from('project_embeddings')
        .delete()
        .eq('project_id', projectId);
    if (delErr) console.error("Delete error:", delErr.message);
    else console.log("Delete successful.");
    
    // Step 4: Try to generate embeddings for first chunk as a test
    const doc = docs[0];
    if (!doc || !doc.content) {
        console.log("No document content found! Cannot ingest.");
        return;
    }
    
    // Simple chunking (same as ChunkingService)
    const content = doc.content;
    const chunkSize = 500;
    const overlap = 50;
    const chunks = [];
    for (let i = 0; i < content.length; i += (chunkSize - overlap)) {
        const chunk = content.substring(i, i + chunkSize).trim();
        if (chunk.length > 0) chunks.push(chunk);
    }
    console.log(`\nChunked into ${chunks.length} pieces. First chunk (100 chars): "${chunks[0].substring(0, 100)}..."`);
    
    // Step 5: Generate ONE embedding as test
    console.log("\nGenerating a single test embedding via Gemini...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${process.env.GEMINI_API_KEY}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'models/gemini-embedding-2-preview',
            outputDimensionality: 768,
            content: { parts: [{ text: chunks[0].substring(0, 2048) }] }
        })
    });
    
    if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`Gemini Embedding FAILED (${resp.status}): ${errBody}`);
        return;
    }
    
    const embData = await resp.json();
    const embedding = embData.embedding?.values;
    console.log(`Embedding generated! Dimensions: ${embedding?.length}`);
    
    // Step 6: Try to INSERT one embedding row
    console.log("\nInserting one test embedding into project_embeddings...");
    const record = {
        project_id: projectId,
        document_group_id: doc.document_group_id,
        document_version: doc.version,
        chunk_index: 0,
        chunk_text: chunks[0],
        embedding: embedding,
        is_active: true,
        source_type: 'DOCUMENT',
        manual_answer_type: null
    };
    
    const { error: insertErr } = await supabase
        .from('project_embeddings')
        .insert([record]);
    
    if (insertErr) {
        console.error(`INSERT FAILED: ${insertErr.message}`);
        console.error("Full error:", JSON.stringify(insertErr));
    } else {
        console.log("INSERT SUCCEEDED! ✅");
    }
    
    // Final count
    const { count: embAfter } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
    console.log(`\nEmbeddings AFTER test: ${embAfter}`);
}

main().catch(err => {
    console.error("FATAL:", err.message);
    console.error(err.stack);
});
