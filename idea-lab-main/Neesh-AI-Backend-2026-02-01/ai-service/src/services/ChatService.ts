import { VectorStoreService, QueryResult } from './VectorStoreService';
import { EmbeddingService } from './EmbeddingService';
import { LlmService } from './LlmService';
import { LearningService } from './LearningService';

// Fallback string for when no context is found AND LLM fails
const NO_CONTEXT_FALLBACK = "I don't have enough specific information in my knowledge base to answer that definitely, but I can help you with other project-related questions!";

export interface ChatResponse {
    answer: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    sources: SourceMetadata[];
    questionId: string;
    answerLogId: string;
}

export interface SourceMetadata {
    document_group_id: string;
    document_version: number;
    chunk_index: number;
    similarity_score: number;
    source_type?: 'DOCUMENT' | 'MANUAL';
}

// Common greetings to detect
const GREETING_PATTERNS = /^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening)|what'?s?\s*up|sup|yo)[\s!?.,]*$/i;

export class ChatService {
    private vectorStore: VectorStoreService;
    private embeddingService: EmbeddingService;
    private llmService: LlmService;
    private learningService: LearningService;

    // Response cache: same projectId + query = same answer (5-minute TTL)
    private responseCache: Map<string, { response: ChatResponse; timestamp: number }> = new Map();
    private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.vectorStore = new VectorStoreService();
        this.embeddingService = new EmbeddingService();
        this.llmService = new LlmService();
        this.learningService = new LearningService();
        console.log('[ChatService] Initialized successfully');
    }

    private getCacheKey(projectId: string, query: string): string {
        return `${projectId}::${query.toLowerCase().trim()}`;
    }

    private getCachedResponse(projectId: string, query: string): ChatResponse | null {
        const key = this.getCacheKey(projectId, query);
        const cached = this.responseCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < ChatService.CACHE_TTL_MS) {
            console.log(`[ChatService] Cache HIT for query: "${query}"`);
            return cached.response;
        }
        if (cached) {
            this.responseCache.delete(key); // expired
        }
        return null;
    }

    private cacheResponse(projectId: string, query: string, response: ChatResponse): void {
        const key = this.getCacheKey(projectId, query);
        this.responseCache.set(key, { response, timestamp: Date.now() });
        // Limit cache size to prevent memory issues
        if (this.responseCache.size > 500) {
            const firstKey = this.responseCache.keys().next().value;
            if (firstKey) this.responseCache.delete(firstKey);
        }
    }

    private isGreeting(query: string): boolean {
        return GREETING_PATTERNS.test(query.trim());
    }

    async askQuestion(projectId: string, query: string, linkedProjectIds?: string[], provider?: string, apiKey?: string, userName?: string, userEmail?: string): Promise<ChatResponse> {
        console.log(`[ChatService] askQuestion called - projectId: ${projectId}, query: "${query}", linkedProjects: ${linkedProjectIds?.length || 0}, provider: ${provider || 'fallback'}, userName: ${userName || 'N/A'}, userEmail: ${userEmail || 'N/A'}`);

        // Check cache first — same question on same project = same answer
        const cached = this.getCachedResponse(projectId, query);
        if (cached) {
            return cached;
        }

        // 0. Log the question
        let questionId: string;
        try {
            questionId = await this.learningService.logQuestion(projectId, query);
            console.log(`[ChatService] Question logged with ID: ${questionId}`);
        } catch (logError: any) {
            console.warn(`[ChatService] Failed to log question (non-fatal): ${logError.message}`);
            questionId = 'unlogged-' + Date.now();
        }

        // Check if this is a greeting — skip RAG for greetings
        if (this.isGreeting(query)) {
            console.log('[ChatService] Detected greeting — using greeting mode (skipping RAG)');
            try {
                const generated = await this.llmService.generateGreeting(query, provider, apiKey);
                const logId = await this.safeLogAnswer(questionId, generated.answer, 'HIGH', false);
                return {
                    answer: generated.answer,
                    confidence: 'HIGH',
                    sources: [],
                    questionId,
                    answerLogId: logId
                };
            } catch (greetingError: any) {
                console.error(`[ChatService] Greeting generation failed: ${greetingError.message}`);
                return {
                    answer: "Hello! 👋 I'm here to help you with questions about this project. Feel free to ask me anything!",
                    confidence: 'HIGH',
                    sources: [],
                    questionId,
                    answerLogId: 'fallback'
                };
            }
        }

        // 1. Try RAG retrieval (hybrid: vector + keyword search)
        let chunks: QueryResult[] = [];
        try {
            console.log('[ChatService] Generating query embedding...');
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            console.log(`[ChatService] Embedding generated, dimensions: ${queryEmbedding.length}`);

            // Hybrid search: vector similarity + keyword matching
            chunks = await this.vectorStore.queryHybrid(projectId, queryEmbedding, query, 5, 0.05);
            console.log(`[ChatService] Hybrid search returned ${chunks.length} chunks`);

            // Query linked projects for knowledge sharing
            if (linkedProjectIds && linkedProjectIds.length > 0) {
                console.log(`[ChatService] Querying ${linkedProjectIds.length} linked projects for knowledge sharing...`);
                const linkedChunks = await this.vectorStore.queryMultipleProjects(linkedProjectIds, queryEmbedding, query, 3, 0.05);
                console.log(`[ChatService] Linked projects returned ${linkedChunks.length} additional chunks`);

                chunks = [...chunks, ...linkedChunks]
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 7);
                console.log(`[ChatService] Merged total: ${chunks.length} chunks`);
            }
        } catch (ragError: any) {
            console.warn(`[ChatService] RAG retrieval failed (falling back to direct LLM): ${ragError.message}`);
        }


        // 2. Priority Logic
        let answer = "";
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let finalSources: SourceMetadata[] = [];
        let isAi = true;

        // Check for OVERRIDE manual answer with high confidence
        const overrideChunk = chunks.find(c =>
            c.source_type === 'MANUAL' &&
            c.manual_answer_type === 'OVERRIDE' &&
            c.similarity >= 0.85
        );

        if (overrideChunk) {
            console.log('[ChatService] Found manual OVERRIDE answer');
            const text = overrideChunk.chunk_text;
            const answerPart = text.split('Answer:')[1];
            answer = answerPart ? answerPart.trim() : text;
            confidence = 'HIGH';
            isAi = false;
            finalSources = [{
                document_group_id: overrideChunk.document_group_id,
                document_version: overrideChunk.document_version,
                chunk_index: overrideChunk.chunk_index,
                similarity_score: overrideChunk.similarity,
                source_type: 'MANUAL'
            }];
        } else {
            // Standard RAG or direct LLM
            const contextTexts = chunks.map(c => c.chunk_text);

            if (chunks.length === 0) {
                console.log('[ChatService] No context chunks — asking LLM to answer directly');
            } else {
                console.log(`[ChatService] Using ${chunks.length} context chunks for RAG generation`);
                confidence = this.calculateConfidence(chunks);
            }

            try {
                const generated = await this.llmService.generateAnswer(query, contextTexts, provider, apiKey);
                answer = generated.answer;

                if (chunks.length === 0) {
                    // LLM answered without RAG context — mark as LOW for reporting but keep the answer
                    confidence = 'LOW';
                    console.log(`[ChatService] LLM answered without KB context, confidence: LOW`);
                } else {
                    console.log(`[ChatService] RAG response generated, confidence: ${confidence}`);
                }
            } catch (llmError: any) {
                console.error(`[ChatService] LLM generation failed: ${llmError.message}`);
                
                if (chunks.length > 0) {
                    // EMERGENCY MODE: Synthesize offline answer from chunks
                    console.log('[ChatService] Entering EMERGENCY OFFLINE MODE (LLM failed but context available)');
                    answer = this.generateOfflineAnswer(query, chunks);
                    confidence = 'LOW'; // Mark as LOW because it's not a real LLM answer
                } else {
                    answer = NO_CONTEXT_FALLBACK;
                    confidence = 'LOW';
                }
            }

            finalSources = chunks.map(c => ({
                document_group_id: c.document_group_id,
                document_version: c.document_version,
                chunk_index: c.chunk_index,
                similarity_score: c.similarity,
                source_type: c.source_type
            }));
        }

        // 3. Log the answer
        const logId = await this.safeLogAnswer(questionId, answer, confidence, isAi);

        // 4. If LOW confidence, auto-report to backend for Response/Notification pages (Req #7)
        if (confidence === 'LOW') {
            this.reportUnansweredQuestion(projectId, query, userName, userEmail).catch(err =>
                console.warn(`[ChatService] Failed to report unanswered question: ${err.message}`)
            );
        }

        console.log(`[ChatService] Response ready - confidence: ${confidence}, answer length: ${answer.length}`);

        const response: ChatResponse = {
            answer,
            confidence,
            sources: finalSources,
            questionId,
            answerLogId: logId
        };

        // Cache the response for consistency
        this.cacheResponse(projectId, query, response);

        return response;
    }

    private async safeLogAnswer(questionId: string, answer: string, confidence: string, isAi: boolean): Promise<string> {
        try {
            const logId = await this.learningService.logAnswer(questionId, answer, confidence as any, isAi);
            console.log(`[ChatService] Answer logged with ID: ${logId}`);
            return logId;
        } catch (logError: any) {
            console.warn(`[ChatService] Failed to log answer (non-fatal): ${logError.message}`);
            return 'unlogged';
        }
    }

    /**
     * Report an unanswered question to the Java backend so it appears
     * in the Response page (Unanswered Questions) and Notification page.
     */
    private async reportUnansweredQuestion(projectId: string, question: string, userName?: string, userEmail?: string): Promise<void> {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
        const url = `${backendUrl}/api/public/projects/${projectId}/questions/report`;

        console.log(`[ChatService] Reporting unanswered question to backend: ${url} (userName: ${userName || 'N/A'}, userEmail: ${userEmail || 'N/A'})`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                source: 'CHATBOT_AUTO',
                userName: userName || null,
                userEmail: userEmail || null
            })
        });

        if (!response.ok) {
            throw new Error(`Backend responded with ${response.status}`);
        }
        console.log('[ChatService] Unanswered question reported successfully');
    }

    private calculateConfidence(chunks: QueryResult[]): 'HIGH' | 'MEDIUM' | 'LOW' {
        if (chunks.length === 0) return 'LOW';
        
        // Gemini 768-dim embeddings often cluster closer together; 
        // 0.10+ is typically strong project-specific context.
        const hasHigh = chunks.some(c => c.similarity >= 0.10);
        const hasMedium = chunks.some(c => c.similarity >= 0.03);

        if (hasHigh) return 'HIGH';
        if (hasMedium) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Synthesize a helpful response from context chunks when LLM is unavailable.
     */
    private generateOfflineAnswer(query: string, chunks: QueryResult[]): string {
        const topChunks = chunks.slice(0, 3);
        let summary = "I'm having trouble connecting to my central brain right now, but I've found some relevant information in the project documents:\n\n";
        
        topChunks.forEach((chunk, i) => {
            // Take the first 300 characters of each chunk
            let text = chunk.chunk_text.trim();
            if (text.length > 300) text = text.substring(0, 300) + "...";
            summary += `• ${text}\n\n`;
        });

        summary += "\nPlease try again in a few moments once my AI services have recovered!";
        return summary;
    }
}
