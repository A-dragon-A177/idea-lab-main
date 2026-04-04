// Test multiple Gemini models to find one with available quota
const API_KEY = "AIzaSyB_TshQ86DvdmRhBtykrPcm37WGNrfD4n8";

const models = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
];

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    console.log(`\n[Test] Trying model: ${model}...`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Say hello in one sentence." }] }],
            generationConfig: { maxOutputTokens: 50, temperature: 0 }
        })
    });

    console.log(`[Test] Status: ${response.status}`);
    const body = await response.json();

    if (response.ok) {
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text || "(no text)";
        console.log(`[Test] ✅ SUCCESS: ${text}`);
        return true;
    } else {
        const msg = body.error?.message || JSON.stringify(body).substring(0, 200);
        console.log(`[Test] ❌ FAILED: ${msg}`);
        return false;
    }
}

async function main() {
    for (const model of models) {
        const ok = await testModel(model);
        if (ok) {
            console.log(`\n🎉 Working model found: ${model}`);
            return;
        }
        // Wait between attempts to avoid hitting rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("\n❌ No working model found with this API key.");
}

main().catch(e => console.error("[Test] Error:", e));
