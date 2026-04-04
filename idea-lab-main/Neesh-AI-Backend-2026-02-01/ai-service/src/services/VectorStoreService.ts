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

    /**
     * Physically remove all embeddings for a project.
     * Used during re-ingestion to ensure no stale data remains.
     */
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

        // 1. Invalidation
        const { error: deactivateError } = await this.supabase
            .from('project_embeddings')
            .update({ is_active: false })
            .eq('project_id', projectId)
            .eq('document_group_id', documentGroupId);

        if (deactivateError) {
            throw new Error(`Failed to invalidate vectors: ${deactivateError.message}`);
        }

        // 2. Prepare Records (Traceable)
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

        // 3. Insert New Active Vectors
        const { error: insertError } = await this.supabase
            .from('project_embeddings')
            .insert(records);

        if (insertError) {
            throw new Error(`Failed to insert vectors: ${insertError.message}`);
        }
    }

    async queryVectors(
        projectId: string,
        queryEmbedding: number[],
        topK: number = 5,
        minScore: number = 0.1 // Lowered for keyword-based matching
    ): Promise<QueryResult[]> {

        const { data, error } = await this.supabase.rpc('match_project_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: minScore,
            match_count: topK,
            filter_project_id: projectId
        });

        if (error) throw new Error(`Query failed: ${error.message}`);

        return data as QueryResult[];
    }

    /**
     * Keyword-based full-text search on chunk_text.
     * Used as a hybrid complement to vector search when hash embeddings
     * produce poor similarity scores for semantic questions.
     */
    async searchByKeywords(
        projectId: string,
        query: string,
        topK: number = 5
    ): Promise<QueryResult[]> {
        // Extract meaningful keywords (> 2 chars, skip stop words)
        const STOP_WORDS = new Set(['what', 'is', 'the', 'this', 'how', 'are', 'does', 'for', 'and', 'from', 'that', 'with', 'was', 'its', 'can', 'you', 'your', 'have', 'has', 'will', 'would', 'about', 'which', 'there', 'their', 'they', 'been', 'more', 'also', 'any', 'all', 'when', 'who', 'did', 'not', 'but', 'our', 'were', 'than', 'very', 'just', 'into', 'some', 'could', 'should', 'tell', 'please']);
        const keywords = query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));

        if (keywords.length === 0) return [];

        console.log(`[VectorStoreService] Keyword search with terms: ${keywords.join(', ')}`);

        // Build OR filter: chunk_text ilike any of the keywords
        const orFilters = keywords.map(kw => `chunk_text.ilike.%${kw}%`).join(',');

        const { data, error } = await this.supabase
            .from('project_embeddings')
            .select('chunk_text, document_group_id, document_version, chunk_index, source_type, manual_answer_type')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .or(orFilters)
            .limit(topK);

        if (error) {
            console.warn(`[VectorStoreService] Keyword search failed: ${error.message}`);
            return [];
        }

        if (!data || data.length === 0) return [];

        // Score by number of keyword matches in the chunk
        const scored = data.map(row => {
            const text = (row.chunk_text || '').toLowerCase();
            const matchCount = keywords.filter(k => text.includes(k)).length;
            const keywordScore = matchCount / keywords.length;
            return {
                chunk_text: row.chunk_text,
                document_group_id: row.document_group_id,
                document_version: row.document_version,
                chunk_index: row.chunk_index,
                similarity: keywordScore * 0.6, // Scale keyword score (0 to 0.6 range)
                source_type: row.source_type,
                manual_answer_type: row.manual_answer_type
            } as QueryResult;
        });

        return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
    }

    /**
     * Hybrid retrieval: combines vector similarity + keyword search.
     * Vector search catches exact embeddings; keyword search catches semantic misses.
     */
    async queryHybrid(
        projectId: string,
        queryEmbedding: number[],
        query: string,
        topK: number = 5,
        minScore: number = 0.05
    ): Promise<QueryResult[]> {
        // Run both searches in parallel
        const [vectorResults, keywordResults] = await Promise.all([
            this.queryVectors(projectId, queryEmbedding, topK, minScore).catch(() => [] as QueryResult[]),
            this.searchByKeywords(projectId, query, topK)
        ]);

        console.log(`[VectorStoreService] Hybrid: ${vectorResults.length} vector + ${keywordResults.length} keyword results`);

        // Merge: prefer vector results, add keyword results not already in vector set
        const seen = new Set<string>();
        const merged: QueryResult[] = [];

        for (const r of vectorResults) {
            const key = `${r.document_group_id}::${r.chunk_index}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(r);
            }
        }

        for (const r of keywordResults) {
            const key = `${r.document_group_id}::${r.chunk_index}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(r);
            }
        }

        // Sort by similarity score descending and take top K
        return merged
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    /**
     * Query vectors across multiple projects for knowledge sharing.
     * Queries each project separately and merges results sorted by similarity.
     */
    async queryMultipleProjects(
        projectIds: string[],
        queryEmbedding: number[],
        query: string,
        topK: number = 5,
        minScore: number = 0.05
    ): Promise<QueryResult[]> {
        if (projectIds.length === 0) return [];

        // Query each project using hybrid search in parallel
        const results = await Promise.all(
            projectIds.map(async (pid) => {
                try {
                    return await this.queryHybrid(pid, queryEmbedding, query, topK, minScore);
                } catch (err: any) {
                    console.warn(`[VectorStoreService] Failed to query project ${pid}: ${err.message}`);
                    return [];
                }
            })
        );

        // Flatten and sort by similarity descending, then take top K
        return results
            .flat()
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }
}
