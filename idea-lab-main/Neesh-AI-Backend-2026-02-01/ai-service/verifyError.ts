import { ChatOrchestrator } from './src/services/rag_v2/ChatOrchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const orchestrator = new ChatOrchestrator();
    const projectId = 'b965337d-1080-4e4c-8932-e329956b7ea0';
    const query = 'Give me the summary';
    
    console.log(`Testing Orchestrator for project: ${projectId}`);
    try {
        const result = await orchestrator.handleQuery(projectId, query, []);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Caught Exception:', err);
    }
}

test();
