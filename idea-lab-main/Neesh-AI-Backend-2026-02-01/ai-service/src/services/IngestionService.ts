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

        // 2. Fetch project and blog metadata to create a virtual document
        const { data: projectData, error: projectError } = await this.supabase
            .from('projects')
            .select('title, one_line_summary, description')
            .eq('id', projectId)
            .single();

        if (projectError) {
            console.error(`[IngestionService] Failed to fetch project data: ${projectError.message}`);
        }

        const { data: blogData, error: blogError } = await this.supabase
            .from('blogs')
            .select('heading, introduction, content')
            .eq('project_id', projectId)
            .maybeSingle();
            
        if (blogError) {
            console.error(`[IngestionService] Failed to fetch blog data: ${blogError.message}`);
        }

        let combinedVirtualContent = "";
        if (projectData) {
            if (projectData.title) combinedVirtualContent += `Project Title: ${projectData.title}\n\n`;
            if (projectData.one_line_summary) combinedVirtualContent += `Summary: ${projectData.one_line_summary}\n\n`;
            if (projectData.description) combinedVirtualContent += `Description: ${projectData.description}\n\n`;
        }
        if (blogData) {
            if (blogData.heading && blogData.heading !== projectData?.title) combinedVirtualContent += `Blog Heading: ${blogData.heading}\n\n`;
            if (blogData.introduction) combinedVirtualContent += `Introduction: ${blogData.introduction}\n\n`;
            if (blogData.content) combinedVirtualContent += `Content: ${blogData.content}\n\n`;
        }

        if (combinedVirtualContent.trim().length > 0) {
            console.log(`[IngestionService] Processing virtual document (Blog/Project data), length: ${combinedVirtualContent.length}`);
            try {
                const virtualChunks = await this.chunkingService.chunkText(combinedVirtualContent);
                if (virtualChunks.length > 0) {
                    const virtualEmbeddings = await this.embeddingService.generateEmbeddings(virtualChunks);
                    // Use the projectId itself as the document_group_id for the virtual document
                    await this.vectorStore.storeVectors(
                        projectId,
                        projectId,
                        1,
                        virtualChunks,
                        virtualEmbeddings
                    );
                    console.log(`[IngestionService] Successfully indexed virtual document (${virtualChunks.length} chunks)`);
                }
            } catch (err: any) {
                console.error(`[IngestionService] ❌ Error processing virtual document:`, err.message);
            }
        }

        // 3. Fetch and process physical documents
        const { data: documents, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true);

        if (error) {
            console.error(`[IngestionService] Failed to fetch documents: ${error.message}`);
        }

        const docsToProcess = documents || [];
        console.log(`[IngestionService] Found ${docsToProcess.length} active documents to index.`);

        for (const doc of docsToProcess) {
            try {
                console.log(`[IngestionService] Processing doc: ${doc.original_filename} (v${doc.version})`);

                const content = doc.content;

                if (!content || content.trim().length === 0) {
                    console.warn(`[IngestionService] Document "${doc.original_filename}" has no extracted text content. Skipping.`);
                    continue;
                }

                console.log(`[IngestionService] Document content length: ${content.length} characters`);

                const chunks = await this.chunkingService.chunkText(content);
                console.log(`[IngestionService] Created ${chunks.length} chunks from document`);

                if (chunks.length === 0) {
                    console.warn(`[IngestionService] No chunks generated for "${doc.original_filename}". Skipping.`);
                    continue;
                }

                const embeddings = await this.embeddingService.generateEmbeddings(chunks);
                console.log(`[IngestionService] Generated ${embeddings.length} embeddings`);

                await this.vectorStore.storeVectors(
                    projectId,
                    doc.document_group_id,
                    doc.version,
                    chunks,
                    embeddings
                );

                console.log(`[IngestionService] Successfully indexed "${doc.original_filename}" (${chunks.length} chunks)`);

            } catch (err: any) {
                console.error(`[IngestionService] ❌ Error processing doc ${doc.id} (${doc.original_filename}):`, err.message);
            }
        }

        // 4. Update ingestion_status to 'completed'
        console.log(`[IngestionService] Updating ingestion_status to 'completed' for project ${projectId}`);
        const { error: updateError } = await this.supabase
            .from('projects')
            .update({ ingestion_status: 'completed' })
            .eq('id', projectId);

        if (updateError) {
            console.error(`[IngestionService] Failed to update project status: ${updateError.message}`);
        }

        console.log(`[IngestionService] Ingestion complete for project ${projectId}`);
    }
}
