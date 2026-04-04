const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugMath() {
    const API_KEY = process.env.GEMINI_API_KEY;
    const text = "Gemini is a powerful AI model.";
    
    console.log("Fetching embedding for:", text);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${API_KEY}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            outputDimensionality: 768
        })
    });
    const data = await response.json();
    const vec = data.embedding.values;

    console.log("Generated vector length:", vec.length);
    console.log("First 5 elements:", vec.slice(0, 5));

    // Cosine similarity between same vector should be 1
    // Cosine distance = 1 - (A.B / (||A|| ||B||))
    // Similarity = A.B / (||A|| ||B||)
    
    // Manual check
    const dotProduct = vec.reduce((sum, val, i) => sum + val * vec[i], 0);
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    const manualSim = dotProduct / (magnitude * magnitude);
    console.log("Manual Self-Similarity:", manualSim);

    // Let's check with slightly different text
    const text2 = "Google's Gemini is a strong AI system.";
    const response2 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: text2 }] },
            outputDimensionality: 768
        })
    });
    const data2 = await response2.json();
    const vec2 = data2.embedding.values;
    
    const dotProduct2 = vec.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    const manualSim2 = dotProduct2 / (mag1 * mag2);
    console.log(`Manual Similarity between "${text}" and "${text2}":`, manualSim2);
}

debugMath().catch(console.error);
