const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect(projectId, query) {
    const emResponse = await fetch('http://localhost:3000/internal/query', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-Internal-Secret': 'neesh-ai-secret-key-123'
        },
        body: JSON.stringify({ projectId, query, topK: 5, minScore: 0.05 }) // Lower threshold to see EVERYTHING
    });
    const { results } = await emResponse.json();

    console.log(`\n=== Inspection for: "${query}" ===`);
    console.log(`Found ${results ? results.length : 0} results.`);
    
    if (results) {
        results.forEach((r, i) => {
            console.log(`\n[Result ${i+1}] Similarity: ${r.similarity_score}`); // Fixed key name
            console.log(`Source: ${r.source_type}`);
            console.log(`Text: ${r.chunk_text.substring(0, 300)}...`);
        });
    }
}

const projectId = '38f36368-abdf-4f4e-9013-811b6f707dff';
inspect(projectId, "What is the financial strategies").catch(console.error);
inspect(projectId, "Explain in simple terms").catch(console.error);
