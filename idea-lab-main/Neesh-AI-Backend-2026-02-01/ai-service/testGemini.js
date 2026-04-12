require('dotenv').config();
const key = process.env.GEMINI_API_KEY;
console.log("Key starting with:", key ? key.substring(0, 10) : "null");

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
})
.then(r => r.json().then(d => console.log('Response:', r.status, d)))
.catch(console.error);
