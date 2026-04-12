import { RetrievalService } from './RetrievalService';
import { DecisionService } from './DecisionService';
import { LlmService } from '../LlmService';
import { VectorStoreService } from '../VectorStoreService';

export interface ChatContractResponse {
    status: 'ANSWER' | 'NO_ANSWER' | 'PROCESSING';
    answer: string | null;
    confidence: 'HIGH' | 'LOW';
}

export class ChatOrchestrator {
    private retrievalService: RetrievalService;
    private decisionService: DecisionService;
    private llmService: LlmService;
    private vectorStore: VectorStoreService;

    constructor() {
        this.retrievalService = new RetrievalService();
        this.decisionService = new DecisionService();
        this.llmService = new LlmService();
        this.vectorStore = new VectorStoreService();
        console.log('[ChatOrchestrator] Initialized successfully');
    }

    async handleQuery(
        projectId: string, 
        query: string, 
        chatHistory: any[],
        provider?: string,
        apiKey?: string
    ): Promise<ChatContractResponse> {
        console.log(`[ChatOrchestrator] handleQuery called - projectId: ${projectId}, query: "${query}"`);

        try {
            // STEP 0: Check for generic greetings
            const safeQuery = String(query || "");
            const cleanQuery = safeQuery.trim().toLowerCase().replace(/[.!?,\s]/g, '');
            const isGreeting = ["hi", "hello", "hey", "goodmorning", "goodevening", "goodafternoon", "greetings", "hithere", "hellothere", "hie", "heyy"].includes(cleanQuery);
            
            if (isGreeting) {
                console.log('[ChatOrchestrator] Greeting detected. Replying politely directly.');
                return {
                    status: 'ANSWER',
                    answer: "Hello! I am your AI assistant. How can I politely help you with your queries today?",
                    confidence: 'HIGH'
                };
            }

            // STEP 1: Get ingestion status
            const ingestionStatus = await this.vectorStore.fetchProjectStatus(projectId);
            
            // STEP 2: Retrieval
            let chunks: any[] = [];
            if (ingestionStatus === 'completed') {
                chunks = await this.retrievalService.retrieveChunks(projectId, query);
            }

            // STEP 3: Decision
            const decision = this.decisionService.decide(chunks, ingestionStatus, chatHistory, safeQuery);
            
            if (decision.action === 'PROCESSING') {
                return {
                    status: 'PROCESSING',
                    answer: "Knowledge base is processing",
                    confidence: 'LOW'
                };
            }

            if (decision.action === 'FALLBACK') {
                console.log('[ChatOrchestrator] Decision: FALLBACK. Returning NO_ANSWER to Java.');
                return {
                    status: 'NO_ANSWER',
                    answer: decision.reason, // e.g. "As of now this is not yet discussed"
                    confidence: 'LOW'
                };
            }

            // STEP 4: Call LLM
            console.log('[ChatOrchestrator] Decision: PROCEED. Querying LLM.');
            const contextTexts = decision.chunks.map(c => c.chunk_text);
            const { answer, confidence } = await this.llmService.generateAnswer(
                query, 
                contextTexts, 
                chatHistory, 
                provider, 
                apiKey
            );

            return {
                status: 'ANSWER',
                answer,
                confidence: confidence as 'HIGH' | 'LOW'
            };

        } catch (error: any) {
            console.error(`[ChatOrchestrator] Exception occurred: ${error.message}`);
            // System failure fallback to prevent crashes - let's send the actual error back to the user
            // so they can see if it's an API key or Rate limit issue
            return {
                status: 'NO_ANSWER',
                answer: "System currently unavailable: " + (error.message || 'Unknown error'),
                confidence: 'LOW'
            };
        }
    }
}
