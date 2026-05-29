import { VectorStoreService, QueryResult } from '../VectorStoreService';
import { EmbeddingService } from '../EmbeddingService';
import { CONFIG } from '../../config';

export class RetrievalService {
    private vectorStore: VectorStoreService;
    private embeddingService: EmbeddingService;

    constructor() {
        this.vectorStore = new VectorStoreService();
        this.embeddingService = new EmbeddingService();
    }

    /**
     * ONLY does: query -> top 5 chunks
     * NO fallback, logging, or LLM logic here.
     */
    async retrieveChunks(projectId: string, query: string, apiKey?: string): Promise<QueryResult[]> {
        console.log(`[RetrievalService] Generating embedding for query: "${query}"`);
        const queryEmbedding = await this.embeddingService.generateEmbedding(query, apiKey);
        
        console.log(`[RetrievalService] Querying vector store for top ${CONFIG.TOP_K} chunks`);
        const chunks = await this.vectorStore.queryVectors(projectId, queryEmbedding, CONFIG.TOP_K, 0.0);
        
        return chunks.sort((a, b) => b.similarity - a.similarity).slice(0, CONFIG.TOP_K);
    }
}
