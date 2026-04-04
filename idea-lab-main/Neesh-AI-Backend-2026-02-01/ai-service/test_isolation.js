const http = require('http');

// Test project isolation:
// Query the TrustLayer AI project with a question about the AI Validation Framework
// It should NOT return answers from the AI Validation Framework project
const trustLayerProjectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';

async function testChat(projectId, query) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ projectId, query });
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/internal/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': 'neesh-ai-secret-key-123',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve({ answer: data, confidence: '?' }); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

async function main() {
    // Test 1: TrustLayer project - should talk about TrustLayer AI
    console.log("=== TEST: TrustLayer AI Project ===");
    const r1 = await testChat(trustLayerProjectId, "What is this project about?");
    console.log(`Confidence: ${r1.confidence}`);
    console.log(`Answer: ${r1.answer}`);
    console.log(`Sources: ${r1.sources?.length || 0} chunks`);
    
    // Check if it mentions TrustLayer (correct) vs AI Validation (wrong)
    const mentionsTrustLayer = r1.answer?.toLowerCase().includes('trustlayer') || r1.answer?.toLowerCase().includes('credibility');
    const mentionsValidation = r1.answer?.toLowerCase().includes('idea validation framework');
    console.log(`\nMentions TrustLayer/credibility: ${mentionsTrustLayer}`);
    console.log(`Mentions AI Validation Framework: ${mentionsValidation}`);
    console.log(mentionsTrustLayer && !mentionsValidation ? "\n✅ ISOLATION WORKING" : "\n⚠️ CHECK ISOLATION");
}

main().catch(e => console.error("Error:", e));
