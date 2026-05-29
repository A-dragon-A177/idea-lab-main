import { QueryResult } from '../VectorStoreService';
import { CONFIG } from '../../config';

export type DecisionResult = 
    | { action: 'PROCESSING' }
    | { action: 'FALLBACK'; reason: string }
    | { action: 'PROCEED'; chunks: QueryResult[] };

export class DecisionService {
    /**
     * Decision rules:
     * 1. Check if ingestionStatus is not 'completed' or null -> returns PROCESSING
     * 2. Check top similarity score
     *   if score < threshold -> returns FALLBACK ("As of now it is not yet discussed")
     *   else -> returns PROCEED (send to LLM)
     */
    public decide(chunks: QueryResult[], ingestionStatus: string | null, chatHistory?: any[], query?: string): DecisionResult {
        if (ingestionStatus !== 'completed') {
            return { action: 'PROCESSING' };
        }

        // If user is holding a conversation (history exists), ALWAYS PROCEED to the LLM
        // so it can answer follow-ups even if the direct vector chunks don't hit perfectly.
        const hasHistory = chatHistory && chatHistory.length > 0;
        
        // Also if it's a manual naked continuation request or a meta-query from the UI default chips
        const normalizedQuery = query ? query.trim().toLowerCase().replace(/['"!?.,]/g, '') : "";
        const conversationalPhrases = [
            "continue", "more", "explain", "explain more", "go on", "please continue",
            "summarize this blog", "summary of this", "give me a summary", 
            "whats the main takeaway", "what is the main takeaway",
            "explain in simple terms", "explain in detail", "related topics", 
            "tell me more", "tell me more about this", "be more specific",
            "what is this", "who are you", "what can you do",
            "what are all the", "available erp", "list of erp", "which erp",
            "details", "elaborate", "summarize", "summary", "how does it work",
            "how it works", "what does it do", "describe", "overview"
        ];
        
        const isConversational = conversationalPhrases.some(phrase => normalizedQuery.includes(phrase));

        if (chunks.length === 0) {
            if (hasHistory || isConversational) {
                return { action: 'PROCEED', chunks: [] };
            }
            return { action: 'FALLBACK', reason: "As of now this is not yet discussed" };
        }

        const topScore = chunks[0].similarity;

        if (topScore < CONFIG.SIMILARITY_THRESHOLD && !hasHistory && !isConversational) {
            return { action: 'FALLBACK', reason: "As of now this is not yet discussed" };
        }

        return { action: 'PROCEED', chunks };
    }
}
