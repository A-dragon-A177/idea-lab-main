const http = require('http');

// Test against the project we just re-indexed
const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';

const tests = [
    "What is Neesh AI?",
    "Summarize the core features of this project.",
    "How does the AI Idea Validation Framework work?",
];

async function testChat(query) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ projectId, query });
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/internal/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': 'neesh-ai-secret-key-123'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ answer: data, confidence: 'PARSE_ERROR' });
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log("=== Testing RAG Chatbot Retrieval ===");
    for (const query of tests) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`QUERY: "${query}"`);
        console.log(`${'='.repeat(60)}`);
        try {
            const result = await testChat(query);
            console.log(`CONFIDENCE: ${result.confidence}`);
            console.log(`ANSWER: ${result.answer}`);
            if (result.sources && result.sources.length > 0) {
                console.log(`SOURCES: ${result.sources.length} chunks used`);
            }
        } catch (e) {
            console.log(`ERROR: ${e.message}`);
        }
        // Wait between requests to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
}

main();
