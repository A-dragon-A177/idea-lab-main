import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface QueryResult {
    chunk_text: string;
    document_group_id: string;
    document_version: number;
    chunk_index: number;
    similarity: number;
    source_type?: 'DOCUMENT' | 'MANUAL';
    manual_answer_type?: 'OVERRIDE' | 'SUPPLEMENT';
}

export interface VectorMetadata {
    source_type: 'DOCUMENT' | 'MANUAL';
    manual_answer_type?: 'OVERRIDE' | 'SUPPLEMENT';
}

export class VectorStoreService {
    private supabase: SupabaseClient;

    constructor() {
        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!sbUrl || !sbKey) {
            throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
        }
        this.supabase = createClient(sbUrl, sbKey);
    }

    async deleteProjectEmbeddings(projectId: string): Promise<void> {
        const { error } = await this.supabase
            .from('project_embeddings')
            .delete()
            .eq('project_id', projectId);

        if (error) {
            throw new Error(`Failed to delete project embeddings: ${error.message}`);
        }
        console.log(`[VectorStoreService] Deleted all embeddings for project ${projectId}`);
    }

    async storeVectors(
        projectId: string,
        documentGroupId: string,
        documentVersion: number,
        chunks: string[],
        embeddings: number[][],
        metadata?: VectorMetadata
    ): Promise<void> {

        const { error: deactivateError } = await this.supabase
            .from('project_embeddings')
            .update({ is_active: false })
            .eq('project_id', projectId)
            .eq('document_group_id', documentGroupId);

        if (deactivateError) {
            throw new Error(`Failed to invalidate vectors: ${deactivateError.message}`);
        }

        const records = chunks.map((chunk, idx) => ({
            project_id: projectId,
            document_group_id: documentGroupId,
            document_version: documentVersion,
            chunk_index: idx,
            chunk_text: chunk,
            embedding: embeddings[idx],
            is_active: true,
            source_type: metadata?.source_type || 'DOCUMENT',
            manual_answer_type: metadata?.manual_answer_type || null
        }));

        if (records.length === 0) return;

        const { error: insertError } = await this.supabase
            .from('project_embeddings')
            .insert(records);

        if (insertError) {
            throw new Error(`Failed to insert vectors: ${insertError.message}`);
        }
    }

    async hasProjectChunks(projectId: string): Promise<boolean> {
        const { count, error } = await this.supabase
            .from('project_embeddings')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('is_active', true);

        if (error) {
            console.error(`[VectorStoreService] Error checking chunks for project ${projectId}:`, error.message);
            return false;
        }

        return (count ?? 0) > 0;
    }

    async queryVectors(
        projectId: string,
        queryEmbedding: number[],
        topK: number = 5,
        minScore: number = 0.0 // Adjusted so DecisionService filters using the ONE threshold
    ): Promise<QueryResult[]> {
        const { data, error } = await this.supabase.rpc('match_project_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: minScore,
            match_count: topK,
            filter_project_id: projectId
        });

        if (error) throw new Error(`Query failed: ${error.message}`);

        return (data || []) as QueryResult[];
    }

    async fetchProjectStatus(projectId: string): Promise<string | null> {
        const { data, error } = await this.supabase
            .from('projects')
            .select('ingestion_status')
            .eq('id', projectId)
            .single();

        if (error) {
            console.warn(`[VectorStoreService] Failed to fetch project status (possibly missing column): ${error.message}. Checking for chunks instead.`);
            // Fallback: Check if embeddings exist for this project
            const hasChunks = await this.hasProjectChunks(projectId);
            return hasChunks ? 'completed' : 'processing';
        }

        console.log(`[VectorStoreService] Project status for ${projectId}: ${data?.ingestion_status}`);
        return data?.ingestion_status || null;
    }
}
