const API_KEY = "AIzaSyB_TshQ86DvdmRhBtykrPcm37WGNrfD4n8";
async function test() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${API_KEY}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: "What is this project about?" }] },
            outputDimensionality: 768
        })
    });
    const data = await response.json();
    if (response.ok) {
        const values = data.embedding?.values;
        console.log("STATUS: OK");
        console.log("DIMENSIONS:", values?.length);
    } else {
        console.log("STATUS: FAILED");
        console.log("ERROR:", data.error?.message || "unknown");
    }
}
test();
