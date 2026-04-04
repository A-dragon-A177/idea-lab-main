// Direct OpenRouter API test
const API_KEY = "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";
const MODEL = "google/gemma-3-4b-it:free";

async function testOpenRouter() {
    console.log("[Test] Calling OpenRouter API directly...");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://neesh-ai.com",
            "X-Title": "Neesh AI Chatbot"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: "Say hello in one sentence." }],
            max_tokens: 100,
            temperature: 0,
            reasoning: { exclude: true }
        })
    });

    console.log("[Test] Status:", response.status);
    const body = await response.text();
    console.log("[Test] Response body:", body);
}

testOpenRouter().catch(e => console.error("[Test] Error:", e));
