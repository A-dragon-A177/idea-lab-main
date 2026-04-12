import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

async function checkColumns() {
    console.log("Checking projects table columns...");
    // We can't directly check columns via Supabase JS without SQL, 
    // but we can try to select one row and see the keys.
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    if (error) {
        console.error("Error fetching projects:", error.message);
    } else if (data && data.length > 0) {
        console.log("Columns found in projects table:", Object.keys(data[0]));
    } else {
        console.log("No data in projects table.");
    }
}

checkColumns();
