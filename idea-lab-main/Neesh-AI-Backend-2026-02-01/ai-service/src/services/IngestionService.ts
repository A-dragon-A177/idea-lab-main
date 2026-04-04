import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChunkingService } from './ChunkingService';
import { EmbeddingService } from './EmbeddingService';
import { VectorStoreService } from './VectorStoreService';

export class IngestionService {
    private supabase: SupabaseClient;
    private chunkingService: ChunkingService;
    private embeddingService: EmbeddingService;
    private vectorStore: VectorStoreService;

    constructor() {
        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!sbUrl || !sbKey) throw new Error("SUPABASE env vars missing");

        this.supabase = createClient(sbUrl, sbKey);
        this.chunkingService = new ChunkingService();
        this.embeddingService = new EmbeddingService();
        this.vectorStore = new VectorStoreService();
    }

    async ingestProject(projectId: string): Promise<void> {
        console.log(`[IngestionService] Starting ingestion for project ${projectId}`);

        // 1. Physically delete existing vectors for a clean slate
        await this.vectorStore.deleteProjectEmbeddings(projectId);
        const { data: documents, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true);

        if (error || !documents) {
            throw new Error(`Failed to fetch documents: ${error?.message || 'No documents found'}`);
        }

        console.log(`[IngestionService] Found ${documents.length} active documents to index.`);

        if (documents.length === 0) {
            console.log('[IngestionService] No documents to ingest.');
            return;
        }

        for (const doc of documents) {
            try {
                console.log(`[IngestionService] Processing doc: ${doc.original_filename} (v${doc.version})`);

                // 2. Use the extracted text content from the database
                // The backend already extracts text via Apache Tika and stores it in the 'content' column
                const content = doc.content;

                if (!content || content.trim().length === 0) {
                    console.warn(`[IngestionService] Document "${doc.original_filename}" has no extracted text content. Skipping.`);
                    continue;
                }

                console.log(`[IngestionService] Document content length: ${content.length} characters`);

                // 3. Chunk the text
                const chunks = await this.chunkingService.chunkText(content);
                console.log(`[IngestionService] Created ${chunks.length} chunks from document`);

                if (chunks.length === 0) {
                    console.warn(`[IngestionService] No chunks generated for "${doc.original_filename}". Skipping.`);
                    continue;
                }

                // 4. Generate embeddings
                const embeddings = await this.embeddingService.generateEmbeddings(chunks);
                console.log(`[IngestionService] Generated ${embeddings.length} embeddings`);

                // 5. Store vectors (Idempotent: deactivates old versions)
                await this.vectorStore.storeVectors(
                    projectId,
                    doc.document_group_id,
                    doc.version,
                    chunks,
                    embeddings
                );

                console.log(`[IngestionService] Successfully indexed "${doc.original_filename}" (${chunks.length} chunks)`);

            } catch (err: any) {
                console.error(`[IngestionService] Error processing doc ${doc.id} (${doc.original_filename}):`, err.message);
                throw err; // Stop and fail the whole ingestion if a doc fails
            }
        }

        console.log(`[IngestionService] Ingestion complete for project ${projectId}`);
    }
}
