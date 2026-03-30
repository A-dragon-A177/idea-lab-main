/**
 * EmbeddingService - Keyword-based fallback
 * 
 * OpenRouter does not provide embedding models, so this service uses a
 * lightweight TF-IDF-style keyword similarity approach as a fallback.
 * This allows the chatbot to function immediately without a dedicated
 * embedding provider. For production-grade RAG, a proper embedding
 * service (e.g., OpenAI, Cohere, or a local model) should be integrated.
 */

export class EmbeddingService {
    private dimensions = 768; // Matches VECTOR(768) in Supabase schema

    constructor() {
        console.log('[EmbeddingService] Initialized with keyword-based fallback (no external embedding API)');
    }

    /**
     * Generate a simple hash-based pseudo-embedding from text.
     * This produces a deterministic vector that can be used for basic similarity
     * matching in pgvector. It's not as good as a real embedding model, but
     * it allows the system to function without one.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const cleanText = text.replace(/\n/g, ' ').toLowerCase();
        const words = cleanText.split(/\s+/).filter(w => w.length > 2);

        // Create a simple hash-based embedding
        const embedding = new Array(this.dimensions).fill(0);

        for (const word of words) {
            // Hash each word to determine which dimensions to activate
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
            }

            // Use the hash to set multiple dimensions
            for (let i = 0; i < 3; i++) {
                const idx = Math.abs((hash + i * 7919) % this.dimensions);
                embedding[idx] += 1.0 / words.length;
            }
        }

        // Normalize the vector to unit length
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }

        return embedding;
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const t of texts) {
            embeddings.push(await this.generateEmbedding(t));
        }
        return embeddings;
    }
}
