import { ChatOrchestrator } from './src/services/rag_v2/ChatOrchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

const orchestrator = new ChatOrchestrator();

orchestrator.handleQuery('38f36368-abdf-4f4e-9013-811b6f707dff', 'Give me the summary', []).then(r => {
    console.log(r);
}).catch(console.error);
