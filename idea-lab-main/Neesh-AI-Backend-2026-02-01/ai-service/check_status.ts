import { VectorStoreService } from './src/services/VectorStoreService';
require('dotenv').config();

const run = async () => {
    try {
        const service = new VectorStoreService();
        const status = await service.fetchProjectStatus("38f36368-abdf-4f4e-9013-811b6f707dff");
        console.log("Project 38f36368-abdf-4f4e-9013-811b6f707dff ingestion_status:", status);
    } catch(e) {
        console.error(e);
    }
};
run();
