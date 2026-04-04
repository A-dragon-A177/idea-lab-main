const apiKey = process.env.GEMINI_API_KEY;

async function testEmbedding(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: "Hello world" }] }
        })
    });
    if (response.ok) {
        const data = await response.json();
        console.log(`[${model}] Success! Dimensions: ${data.embedding.values.length}`);
    } else {
        console.log(`[${model}] Failed: ${response.status} - ${await response.text()}`);
    }
}

async function run() {
    await testEmbedding('text-embedding-004');
    await testEmbedding('gemini-embedding-2-preview');
    await testEmbedding('gemini-embedding-001');
}

require('dotenv').config();
run();
