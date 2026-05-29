/**
 * EmbeddingService - Gemini gemini-embedding-2-preview
 * 
 * Uses Google's free Gemini Embedding API to generate real semantic embeddings.
 * Falls back to a keyword-based hash approach if the API call fails.
 * 
 * The gemini-embedding-2-preview model produces 3072-dimensional embeddings,
 * matching the VECTOR(3072) column in Supabase.
 */

export class EmbeddingService {
    private dimensions = 768;
    private geminiApiKey: string | null;
    private embeddingModel = 'gemini-embedding-2-preview';

    constructor() {
        this.geminiApiKey = process.env.GEMINI_API_KEY || null;
        if (this.geminiApiKey) {
            console.log(`[EmbeddingService] Initialized with Gemini embedding model: ${this.embeddingModel}`);
        } else {
            console.log('[EmbeddingService] No GEMINI_API_KEY set — using keyword-based fallback (no semantic embeddings)');
        }
    }

    /**
     * Generate embedding using Gemini gemini-embedding-001 API.
     * Falls back to hash-based embedding if API is unavailable.
     */
    async generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
        const activeKey = apiKey || this.geminiApiKey;
        if (activeKey) {
            try {
                return await this.callGeminiEmbedding(text, activeKey);
            } catch (error: any) {
                console.warn(`[EmbeddingService] Gemini embedding failed, falling back to hash: ${error.message}`);
                return this.hashEmbedding(text);
            }
        }
        return this.hashEmbedding(text);
    }

    /**
     * Generate embeddings for multiple texts.
     * Uses Gemini batch embedding API for efficiency.
     */
    async generateEmbeddings(texts: string[], apiKey?: string): Promise<number[][]> {
        const activeKey = apiKey || this.geminiApiKey;
        if (activeKey && texts.length > 0) {
            // During bulk ingestion, we REQUIRE real Gemini embeddings.
            // If it fails (e.g. rate limit), we throw so the caller knows,
            // rather than silently falling back to low-quality hashes.
            return await this.callGeminiBatchEmbedding(texts, activeKey);
        }
        return texts.map(t => this.hashEmbedding(t));
    }

    /**
     * Call Gemini Embedding API for a single text.
     */
    private async callGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${this.embeddingModel}`,
                outputDimensionality: this.dimensions,
                content: {
                    parts: [{ text: text.substring(0, 2048) }] // Limit text length for embedding
                }
            }),
            signal: AbortSignal.timeout(15000) // 15s timeout
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini Embedding API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const embedding = data.embedding?.values;

        if (!embedding || embedding.length === 0) {
            throw new Error('Gemini Embedding API returned empty embedding');
        }

        return embedding;
    }

    /**
     * Call Gemini Batch Embedding API for multiple texts.
     * Processes in tiny batches with longer delays for rate-limit safety.
     */
    private async callGeminiBatchEmbedding(texts: string[], apiKey: string): Promise<number[][]> {
        const batchSize = 2; // Maximum safety for Gemini Free Tier
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const requests = batch.map(text => ({
                model: `models/${this.embeddingModel}`,
                outputDimensionality: this.dimensions,
                content: { parts: [{ text: text.substring(0, 2048) }] }
            }));

            let retryCount = 0;
            const maxRetries = 15; // Even more retries
            let success = false;

            while (retryCount < maxRetries && !success) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:batchEmbedContents?key=${apiKey}`;
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requests }),
                        signal: AbortSignal.timeout(15000) // 15s timeout
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const embeddings = data.embeddings;
                        if (!embeddings || embeddings.length === 0) throw new Error('Empty embeddings');
                        
                        for (const emb of embeddings) {
                            allEmbeddings.push(emb.values);
                        }
                        success = true;
                    } else if (response.status === 429) {
                        retryCount++;
                        const waitTime = Math.pow(2, retryCount) * 5000; // Even slower backoff
                        console.warn(`[EmbeddingService] Rate limit hit (429). Retrying in ${waitTime}ms... (Attempt ${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        const errorBody = await response.text();
                        console.error(`[EmbeddingService] API error (${response.status}): ${errorBody}`);
                        throw new Error(`Gemini API error ${response.status}`);
                    }
                } catch (error) {
                    if (retryCount >= maxRetries) throw error;
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }

            if (!success) {
                throw new Error(`Failed to generate embeddings after ${maxRetries} retries.`);
            }

            // 2s delay between batches for rate limiting
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`[EmbeddingService] Generated ${allEmbeddings.length} Gemini embeddings successfully.`);
        return allEmbeddings;
    }

    /**
     * Fallback: Simple hash-based pseudo-embedding.
     * Only used when Gemini API is unavailable.
     */
    private hashEmbedding(text: string): number[] {
        const cleanText = text.replace(/\n/g, ' ').toLowerCase();
        const words = cleanText.split(/\s+/).filter(w => w.length > 2);
        const embedding = new Array(this.dimensions).fill(0);

        for (const word of words) {
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
            }
            for (let i = 0; i < 3; i++) {
                const idx = Math.abs((hash + i * 7919) % this.dimensions);
                embedding[idx] += 1.0 / words.length;
            }
        }

        const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }

        return embedding;
    }
}
