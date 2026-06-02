import { FOUNDER_SYSTEM_PROMPT, constructUserPrompt } from '../prompts/SystemPrompts';
import { CONFIG } from '../config';
export type LlmProvider = string;

export interface GeneratedAnswer {
    answer: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ProviderConfig {
    provider: LlmProvider;
    apiKey: string;
}

export class LlmService {
    // Fallback config from env (used if user hasn't configured a key)
    private fallbackApiKey: string | null;
    private fallbackModel: string;
    private fallbackProvider: string;

    // Mutex queue to serialize Gemini calls and avoid concurrent rate-limit hits
    private geminiQueue: Promise<void> = Promise.resolve();

    constructor() {
        this.fallbackProvider = (process.env.DEFAULT_LLM_PROVIDER || 'OPENROUTER').toUpperCase();

        if (this.fallbackProvider === 'GEMINI') {
            this.fallbackApiKey = process.env.GEMINI_API_KEY || null;
            this.fallbackModel = 'gemini-2.5-flash';
            if (this.fallbackApiKey) {
                console.log(`[LlmService] Initialized with Gemini fallback model: ${this.fallbackModel}`);
            } else {
                console.log('[LlmService] DEFAULT_LLM_PROVIDER is GEMINI but no GEMINI_API_KEY set');
            }
        } else {
            this.fallbackApiKey = process.env.OPENROUTER_API_KEY || null;
            this.fallbackModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';
            if (this.fallbackApiKey) {
                console.log(`[LlmService] Initialized with OpenRouter fallback model: ${this.fallbackModel}`);
            } else {
                console.log('[LlmService] No fallback OPENROUTER_API_KEY set — user must provide their own key');
            }
        }
    }

    /**
     * Resolve provider config: use user-provided if available, else fallback
     */
    private resolveConfig(provider?: string, apiKey?: string): ProviderConfig {
        if (provider && apiKey) {
            return { provider: provider.toUpperCase() as LlmProvider, apiKey };
        }
        if (this.fallbackApiKey) {
            return { provider: this.fallbackProvider as LlmProvider, apiKey: this.fallbackApiKey };
        }
        throw new Error('No LLM API key configured. Please add your API key in Settings.');
    }

    /**
     * Strip chain-of-thought / reasoning text from LLM responses.
     */
    private stripReasoning(text: string): string {
        if (!text) return text;

        const trimmed = text.trim();

        const reasoningPrefixes = [
            /^(?:Okay|Ok|Alright|Let me|So,? |First|Hmm|Right|Now|Wait|Thinking|I think|Looking)/i,
        ];

        let hasReasoning = false;
        for (const pattern of reasoningPrefixes) {
            if (pattern.test(trimmed)) {
                const metaPhrases = /(?:the user|I need to|I should|let'?s|looking at|the question|user'?s|need to respond|keep it|should be|maybe|perhaps|putting it|make sure|checking|instructions?)/i;
                if (metaPhrases.test(trimmed.substring(0, 300))) {
                    hasReasoning = true;
                    break;
                }
            }
        }

        if (!hasReasoning) return text;

        console.log('[LlmService] Detected reasoning text in response, stripping...');

        const blocks = trimmed.split(/\n\n+/);
        if (blocks.length >= 2) {
            for (let i = 1; i < blocks.length; i++) {
                const block = blocks[i].trim();
                const isReasoning = /^(?:Okay|Ok|Alright|Let me|So |First|Hmm|Wait|Also|But|Now|Check|I (?:need|should|think|want))/i.test(block);
                if (!isReasoning && block.length > 15) {
                    const answer = blocks.slice(i).join('\n\n').trim();
                    console.log(`[LlmService] Stripped reasoning, kept answer: ${answer.length} chars`);
                    return answer;
                }
            }
        }

        const answerPatterns = [
            /(?:^|\n)("?(?:Hello|Hi|Hey|Welcome|Greetings|Thank)[^]*)/im,
            /(?:^|\n)("?(?:The (?:product|project|platform|application|system|service))[^]*)/im,
            /(?:^|\n)("?(?:Based on|According to|From the)[^]*)/im,
            /(?:^|\n)("?(?:This (?:is|project|product|platform))[^]*)/im,
            /(?:^|\n)("?(?:I'?m here|I can help|Feel free)[^]*)/im,
        ];

        for (const pattern of answerPatterns) {
            const match = trimmed.match(pattern);
            if (match && match[1] && match[1].trim().length > 15) {
                console.log(`[LlmService] Found answer via pattern match: ${match[1].trim().length} chars`);
                return match[1].trim();
            }
        }

        const lastBlock = blocks[blocks.length - 1].trim();
        if (lastBlock.length > 15 && blocks.length >= 2) {
            console.log(`[LlmService] Using last paragraph as answer: ${lastBlock.length} chars`);
            return lastBlock;
        }

        console.log('[LlmService] Could not strip reasoning, returning original');
        return text;
    }

    /**
     * Generate an answer using RAG context or direct Q&A
     */
    async generateAnswer(query: string, contextChunks: string[], history: any[], provider?: string, apiKey?: string): Promise<{ answer: string; confidence: string }> {
        console.log(`[LlmService] generateAnswer called - query: "${query}", chunks: ${contextChunks.length}`);

        const config = this.resolveConfig(provider, apiKey);

        try {
            // Respect MAX constraints
            const limitedContext = contextChunks.slice(0, CONFIG.MAX_CONTEXT_CHUNKS);
            const limitedHistory = history && history.length > 0 ? history.slice(-CONFIG.MAX_HISTORY) : [];

            const userPrompt = constructUserPrompt(query, limitedContext, limitedHistory);
            console.log('[LlmService] Using RAG mode with context');

            const messages = [
                { role: 'system', content: FOUNDER_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ];

            let text = await this.callProviderWithFallback(config, messages, 4000, 0);

            // Final fallback if totally empty (API issue)
            if (!text.trim()) {
                console.warn('[LlmService] Both providers failed or empty, returning fallback string');
                return { 
                    answer: "I couldn't generate a specific answer right now. Could you please try again?", 
                    confidence: 'LOW' 
                };
            }

            console.log(`[LlmService] Generated response successfully, length: ${text.length}`);

            return { answer: text.trim(), confidence: 'HIGH' };

        } catch (error: any) {
            console.error("[LlmService] LLM Generation Error:", error.message || error);
            throw error;
        }
    }

    /**
     * Call provider with automatic fallback if the first attempt fails.
     */
    private async callProviderWithFallback(config: ProviderConfig, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        try {
            // 1. Primary Try
            console.log(`[LlmService] Attempting primary provider: ${config.provider}`);
            return await this.callProvider(config, messages, maxTokens, temperature);
        } catch (error: any) {
            // Don't fallback on auth errors of the primary provider — they need fixing in settings
            if (error.message?.includes('Invalid') || error.message?.includes('API key')) {
                throw error;
            }

            const primaryError = error.message || 'Unknown error';
            console.warn(`[LlmService] Primary provider (${config.provider}) failed: ${primaryError}. Attempting fallback...`);

            // 2. Fallback Try
            let fallbackConfig: ProviderConfig | null = null;
            if (config.provider === 'OPENROUTER' && process.env.GEMINI_API_KEY) {
                fallbackConfig = { provider: 'GEMINI', apiKey: process.env.GEMINI_API_KEY };
            } else if (config.provider === 'GEMINI' && process.env.OPENROUTER_API_KEY) {
                fallbackConfig = { provider: 'OPENROUTER', apiKey: process.env.OPENROUTER_API_KEY };
            }

            if (fallbackConfig) {
                try {
                    console.log(`[LlmService] Running FALLBACK using ${fallbackConfig.provider}...`);
                    return await this.callProvider(fallbackConfig, messages, maxTokens, temperature);
                } catch (fallbackError: any) {
                    const fbError = fallbackError.message || 'Unknown error';
                    console.error(`[LlmService] Fallback also failed: ${fbError}`);
                    
                    // Cleaner error message for the end user/developer
                    if (fbError.includes('Invalid') || fbError.includes('API key')) {
                        throw new Error(`The primary AI service is currently overloaded (${primaryError.substring(0, 50)}...), and your fallback API key for ${fallbackConfig.provider} appears to be invalid. Please check your settings.`);
                    }
                    
                    throw new Error(`Both primary and fallback AI providers are currently unavailable. Primary: ${primaryError.substring(0, 60)}. Fallback: ${fbError.substring(0, 60)}.`);
                }
            }

            throw error; // Re-throw if no fallback available
        }
    }

    /**
     * Route to the correct provider's API
     */
    private async callProvider(config: ProviderConfig, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        switch (config.provider) {
            case 'OPENROUTER':
                return this.callOpenRouter(config.apiKey, messages, maxTokens, temperature);
            case 'OPENAI':
                return this.callOpenAI(config.apiKey, messages, maxTokens, temperature);
            case 'CLAUDE':
                return this.callClaude(config.apiKey, messages, maxTokens, temperature);
            case 'GEMINI_15_FLASH':
            case 'GEMINI_15_PRO':
            case 'GEMINI':
                return this.callGemini(config.apiKey, messages, maxTokens, temperature);
            default:
                console.warn(`[LlmService] Provider ${config.provider} not explicitly supported for text chat yet. Falling back to default OpenRouter if available.`);
                if (this.fallbackApiKey) {
                    return this.callOpenRouter(this.fallbackApiKey, messages, maxTokens, temperature);
                }
                throw new Error(`Provider ${config.provider} is not supported for text generation and no default fallback key exists.`);
        }
    }

    /**
     * OpenRouter API (existing logic, parameterized)
     */
    private async callOpenRouter(apiKey: string, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        const model = this.fallbackModel;
        console.log(`[LlmService] Sending request to OpenRouter (${model})...`);

        // Convert system messages to user messages to support models like Gemma that don't allow system instructions
        const processedMessages = [];
        let systemPrompt = '';
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt += msg.content + '\n\n';
            } else if (msg.role === 'user') {
                if (systemPrompt) {
                    processedMessages.push({ role: 'user', content: systemPrompt + msg.content });
                    systemPrompt = '';
                } else {
                    processedMessages.push(msg);
                }
            } else {
                processedMessages.push(msg);
            }
        }

        const maxRetries = 3;
        let lastError = '';
        let data: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://neesh-ai.com',
                    'X-Title': 'Neesh AI Chatbot'
                },
                body: JSON.stringify({
                    model,
                    messages: processedMessages,
                    max_tokens: maxTokens,
                    temperature,
                    seed: 42,
                    reasoning: { exclude: true }
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
                data = await response.json();
                console.log(`[LlmService] OpenRouter responded successfully on attempt ${attempt}`);
                break;
            }

            const errorBody = await response.text();
            lastError = errorBody;

            if (response.status === 401) {
                throw new Error('Invalid OpenRouter API key. Please check your key in Settings.');
            }
            if (response.status === 429 && attempt < maxRetries) {
                const waitMs = attempt * 3000;
                console.warn(`[LlmService] Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }
            if (response.status === 429) {
                throw new Error('OpenRouter rate limit exceeded. Please try again later.');
            }

            console.error(`[LlmService] OpenRouter API error (${response.status}): ${errorBody}`);
            throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
        }

        if (!data) {
            throw new Error(`OpenRouter API failed after ${maxRetries} retries: ${lastError}`);
        }

        const rawText = data.choices?.[0]?.message?.content || '';
        return this.stripReasoning(rawText);
    }

    /**
     * OpenAI API (ChatGPT)
     */
    private async callOpenAI(apiKey: string, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        const model = 'gpt-4o-mini';
        console.log(`[LlmService] Sending request to OpenAI (${model})...`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                seed: 42,
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 401) {
                throw new Error('Invalid OpenAI API key. Please check your key in Settings.');
            }
            if (response.status === 429) {
                throw new Error('OpenAI rate limit exceeded. Please try again later or check your usage limits.');
            }
            if (response.status === 402) {
                throw new Error('OpenAI: Insufficient quota. Please check your billing details.');
            }
            console.error(`[LlmService] OpenAI API error (${response.status}): ${errorBody}`);
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || '';
        console.log(`[LlmService] OpenAI responded successfully`);
        return this.stripReasoning(rawText);
    }

    /**
     * Claude / Anthropic API
     */
    private async callClaude(apiKey: string, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        const model = 'claude-sonnet-4-20250514';
        console.log(`[LlmService] Sending request to Claude/Anthropic (${model})...`);

        // Anthropic uses a different message format: system is separate, messages use 'user'/'assistant' roles
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const anthropicMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature,
                system: systemMessage,
                messages: anthropicMessages
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 401) {
                throw new Error('Invalid Claude/Anthropic API key. Please check your key in Settings.');
            }
            if (response.status === 429) {
                throw new Error('Claude rate limit exceeded. Please try again later.');
            }
            if (response.status === 400) {
                // Parse Anthropic error for more detail
                try {
                    const errJson = JSON.parse(errorBody);
                    throw new Error(`Claude API error: ${errJson.error?.message || errorBody}`);
                } catch (parseErr: any) {
                    if (parseErr.message.startsWith('Claude')) throw parseErr;
                    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
                }
            }
            console.error(`[LlmService] Claude API error (${response.status}): ${errorBody}`);
            throw new Error(`Claude API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        // Anthropic response format: { content: [{ type: 'text', text: '...' }] }
        const rawText = data.content?.[0]?.text || '';
        console.log(`[LlmService] Claude responded successfully`);
        return this.stripReasoning(rawText);
    }

    /**
     * Google Gemini API — serialized through a mutex queue to prevent concurrent rate-limit failures.
     */
    private async callGemini(apiKey: string, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        // Enqueue: wait for any previous Gemini call to finish before starting ours
        return new Promise<string>((resolve, reject) => {
            this.geminiQueue = this.geminiQueue.then(async () => {
                try {
                    const result = await this._callGeminiInternal(apiKey, messages, maxTokens, temperature);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    private async _callGeminiInternal(apiKey: string, messages: any[], maxTokens: number, temperature: number): Promise<string> {
        const model = process.env.Gemini_MODEL || 'gemini-2.5-flash';
        console.log(`[LlmService] Sending request to Google Gemini (${model})...`);
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const geminiContents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const maxRetries = 5;
        let lastError = '';
        let data: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: geminiContents,
                    systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
                    generationConfig: {
                        maxOutputTokens: maxTokens,
                        temperature,
                    }
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
                data = await response.json();
                console.log(`[LlmService] Gemini responded successfully on attempt ${attempt}`);
                break;
            }

            const errorBody = await response.text();
            lastError = errorBody;
            const isTransientError = [429, 500, 502, 503, 504].includes(response.status);
            if (isTransientError && attempt < maxRetries) {
                // Exponential backoff: 3s, 9s, 27s for 429; 2s, 4s, 8s for 5xx
                const waitMs = response.status === 429
                    ? Math.pow(3, attempt) * 1000  // 3s, 9s, 27s, 81s
                    : Math.pow(2, attempt) * 1000;  // 2s, 4s, 8s, 16s
                console.warn(`[LlmService] Gemini error (${response.status}), retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }

            if (response.status === 400 && errorBody.includes('API_KEY_INVALID')) {
                throw new Error('Invalid Gemini API key. Please check your key in Settings.');
            }
            if (response.status === 403) {
                throw new Error('Gemini API key does not have permission. Please check your API key and enable the Generative Language API.');
            }

            // 429 is already handled by the isTransientError block above.
            // If we reach here with a 429, all retries are exhausted.
            if (response.status === 429) {
                throw new Error('Gemini rate limit exceeded after retries. Please try again in 10-20 seconds.');
            }

            throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
        }

        if (!data) {
            throw new Error(`Gemini API failed after ${maxRetries} retries: ${lastError}`);
        }

        // Gemini response format: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`[LlmService] Gemini responded successfully`);
        return this.stripReasoning(rawText);
    }
}
