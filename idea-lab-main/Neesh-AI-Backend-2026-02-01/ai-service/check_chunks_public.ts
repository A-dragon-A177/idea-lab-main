import { VectorStoreService } from './src/services/VectorStoreService';
require('dotenv').config();

const run = async () => {
    try {
        const service = new VectorStoreService();
        const hasChunks = await service.hasProjectChunks("dac6b850-89e8-472b-891d-8568a0c575c8");
        console.log("hasChunks result:", hasChunks);
    } catch(e) {
        console.error(e);
    }
};
run();
