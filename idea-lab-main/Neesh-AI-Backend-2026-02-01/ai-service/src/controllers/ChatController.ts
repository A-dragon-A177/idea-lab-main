import { Request, Response } from 'express';
import { ChatOrchestrator } from '../services/rag_v2/ChatOrchestrator';
import { IngestionService } from '../services/IngestionService';
import { VectorStoreService } from '../services/VectorStoreService';
import { EmbeddingService } from '../services/EmbeddingService';

export class ChatController {
    private orchestrator: ChatOrchestrator;
    private ingestionService: IngestionService;
    private vectorStore: VectorStoreService;
    private embeddingService: EmbeddingService;

    constructor() {
        this.orchestrator = new ChatOrchestrator();
        this.ingestionService = new IngestionService();
        this.vectorStore = new VectorStoreService();
        this.embeddingService = new EmbeddingService();
    }

    async ingestProject(req: Request, res: Response) {
        const { projectId } = req.params;
        if (!projectId) return res.status(400).json({ error: "Missing projectId" });

        try {
            this.ingestionService.ingestProject(projectId).catch(err => {
                console.error(`[ChatController] Async Ingestion Error for project ${projectId}:`, err);
            });
            return res.status(202).json({ status: "Ingestion started", projectId });
        } catch (error: any) {
            console.error("Ingestion Error:", error);
            return res.status(500).json({ error: "Internal Server Error during ingestion" });
        }
    }

    async queryVectorStore(req: Request, res: Response) {
        const { projectId, query, topK, minScore } = req.body;
        if (!projectId || !query) return res.status(400).json({ error: "Missing projectId or query" });

        const limit = topK ? parseInt(topK) : 5;
        const threshold = minScore ? parseFloat(minScore) : 0.0;

        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            const results = await this.vectorStore.queryVectors(projectId, queryEmbedding, limit, threshold);
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

    async chatWithProject(req: Request, res: Response) {
        // API Contract Expects:
        // { "projectId": "123", "query": "What is ERP?", "chat_history": [...] }
        const { project_id, projectId, query, chat_history, provider, apiKey } = req.body;
        const targetProjectId = project_id || projectId;
        
        console.log(`[ChatController] chatWithProject API hit - projectId: ${targetProjectId}, query: "${query}"`);
        console.debug(`[ChatController] Full request body received:`, JSON.stringify(req.body));

        if (!targetProjectId || !query) {
            console.warn('[ChatController] Missing project_id or query');
            return res.status(400).json({ error: "Missing project_id or query" });
        }

        try {
            const response = await this.orchestrator.handleQuery(
                targetProjectId, 
                query, 
                chat_history || [],
                provider,
                apiKey
            );

            console.log(`[ChatController] Chat response generated successfully for project ${targetProjectId}`);
            console.debug(`[ChatController] Returning response to Backend:`, JSON.stringify(response));
            
            // Return exact API Contract Response:
            // { "status": "ANSWER" | "NO_ANSWER" | "PROCESSING", "answer": "...", "confidence": "HIGH" | "LOW" }
            return res.json(response);

        } catch (error: any) {
            console.error("[ChatController] Chat Error:", error.message);
            console.error(error.stack);
            // System level fallback structure matching API contract
            return res.status(500).json({
                status: 'NO_ANSWER',
                answer: "Internal Server Error during chat",
                confidence: 'LOW'
            });
        }
    }
}
