const http = require('http');

const projectId = '38f36368-abdf-4f4e-9013-811b6f707dff';

const tests = [
    "Explain in simple terms",
    "What is the financial strategies"
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
                'X-Internal-Secret': 'neesh-ai-secret-key-123',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

async function main() {
    for (const query of tests) {
        console.log(`QUERY: "${query}"`);
        const result = await testChat(query);
        console.log(`CONFIDENCE: ${result.confidence}`);
        console.log(`ANSWER: ${result.answer}`);
        console.log(`SOURCES: ${result.sources?.length} chunks\n`);
    }
}
main();
