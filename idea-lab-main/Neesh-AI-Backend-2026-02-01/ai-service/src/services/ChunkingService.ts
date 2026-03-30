import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export class ChunkingService {
    private splitter: RecursiveCharacterTextSplitter;

    constructor() {
        // HARDENING: Deterministic Configuration
        // Fixed chunk size and overlap ensures same output for same input
        // Separators order ensures consistent splitting hierarchy
        this.splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
            separators: ["\n\n", "\n", " ", ""],
            keepSeparator: false
        });
    }

    async chunkText(text: string): Promise<string[]> {
        if (!text) return [];

        // Normalize newlines? Maybe helpful for determinism across OS
        const normalizedText = text.replace(/\r\n/g, "\n");

        const chunks = await this.splitter.createDocuments([normalizedText]);

        // Safety check for empty chunks?
        return chunks
            .map(chunk => chunk.pageContent)
            .filter(content => content.trim().length > 0);
    }
}
