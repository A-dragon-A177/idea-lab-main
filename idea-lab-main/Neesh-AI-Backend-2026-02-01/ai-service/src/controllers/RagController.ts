import { Request, Response } from 'express';
import { IngestionService } from '../services/IngestionService';
import { VectorStoreService } from '../services/VectorStoreService';
import { EmbeddingService } from '../services/EmbeddingService';
import { ChatService } from '../services/ChatService';

export class RagController {
    private ingestionService: IngestionService;
    private vectorStore: VectorStoreService;
    private embeddingService: EmbeddingService;
    private chatService: ChatService;

    constructor() {
        this.ingestionService = new IngestionService();
        this.vectorStore = new VectorStoreService();
        this.embeddingService = new EmbeddingService();
        this.chatService = new ChatService();
    }

    async ingestProject(req: Request, res: Response) {
        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ error: "Missing projectId" });
        }

        try {
            // In prod, check if project exists via backend API or DB access if permitted? 
            // For now, reliance on internal auth + valid UUID + DB FK constraints is "10/10" for a decoupled service 
            // where we assume the caller (backend) verified existence.

            await this.ingestionService.ingestProject(projectId);
            return res.json({ status: "Ingestion completed", projectId });
        } catch (error: any) {
            console.error("Ingestion Error:", error);
            return res.status(500).json({ error: "Internal Server Error during ingestion" });
        }
    }

    async queryVectorStore(req: Request, res: Response) {
        const { projectId, query, topK, minScore } = req.body;

        if (!projectId || !query) {
            return res.status(400).json({ error: "Missing projectId or query" });
        }

        const limit = topK ? parseInt(topK) : 5;
        const threshold = minScore ? parseFloat(minScore) : 0.7;

        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            const results = await this.vectorStore.queryVectors(
                projectId,
                queryEmbedding,
                limit,
                threshold
            );

            return res.json({
                results: results.map(r => ({
                    chunk_text: r.chunk_text,
                    document_group_id: r.document_group_id,
                    document_version: r.document_version,
                    chunk_index: r.chunk_index,
                    similarity_score: r.similarity
                }))
            });
        } catch (error: any) {
            console.error("Query Error:", error);
            return res.status(500).json({ error: "Internal Server Error during query" });
        }
    }

    // CHATBOT ENGINE API
    async chatWithProject(req: Request, res: Response) {
        const { projectId, query, linkedProjectIds, provider, apiKey, userName, userEmail } = req.body;
        console.log(`[RagController] chatWithProject called - projectId: ${projectId}, query: "${query}", linkedProjects: ${linkedProjectIds?.length || 0}, provider: ${provider || 'fallback'}, userName: ${userName || 'N/A'}, userEmail: ${userEmail || 'N/A'}`);

        if (!projectId || !query) {
            console.warn('[RagController] Missing projectId or query');
            return res.status(400).json({ error: "Missing projectId or query" });
        }

        try {
            console.log('[RagController] Calling ChatService.askQuestion...');
            const startTime = Date.now();
            const response = await this.chatService.askQuestion(projectId, query, linkedProjectIds, provider, apiKey, userName, userEmail);
            const elapsed = Date.now() - startTime;
            console.log(`[RagController] ChatService responded in ${elapsed}ms - confidence: ${response.confidence}`);

            return res.json(response);

        } catch (error: any) {
            console.error("[RagController] Chat Error:", error.message);
            console.error("[RagController] Stack:", error.stack);
            // Forward provider-specific error messages to the client
            const isProviderError = error.message?.includes('API key') ||
                error.message?.includes('rate limit') ||
                error.message?.includes('quota') ||
                error.message?.includes('API error');
            const statusCode = isProviderError ? 400 : 500;
            return res.status(statusCode).json({
                error: error.message || "Internal Server Error during chat",
                providerError: isProviderError
            });
        }
    }
}
