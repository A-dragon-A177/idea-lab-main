const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testEmbedding() {
    const texts = ["Hello world, this is a test.", "Another test sentence."];
    
    console.log("Calling ingestion for a tiny project with these texts...");
    // Actually, I'll just call the internal service if I can.
    // Instead, I'll use /internal/ingest/ on a project with only 1 small doc.
}

async function directTest() {
    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${API_KEY}`;
    
    const requests = [{
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: "Hello" }] }
    }];
    
    console.log("Direct API Test...");
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests })
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data).substring(0, 500));
}

directTest();
