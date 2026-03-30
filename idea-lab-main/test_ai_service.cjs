const http = require('http');

const data = JSON.stringify({
    projectId: 'c7e3f37b-90fe-4d68-a2a7-bca5d2800f27',
    query: 'Test message from script'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/internal/chat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-Internal-Secret': 'neesh-ai-secret-key-123'
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('BODY: ' + body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
