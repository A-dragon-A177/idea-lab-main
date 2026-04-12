const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres:Supabase@123@db.svtpjdaxikucgpflbeln.supabase.co:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    
    // First let's check if the table already exists
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'blog_comments'
      );
    `);
    
    console.log("Table exists:", res.rows[0].exists);

    const query = `
      CREATE TABLE IF NOT EXISTS blog_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Anon can insert comments" ON blog_comments;
      CREATE POLICY "Anon can insert comments" 
          ON blog_comments FOR INSERT TO anon, authenticated
          WITH CHECK (true);

      DROP POLICY IF EXISTS "Anon can read comments" ON blog_comments;
      CREATE POLICY "Anon can read comments" 
          ON blog_comments FOR SELECT TO anon, authenticated
          USING (true);
    `;

    await client.query(query);
    console.log("Table and policies created successfully.");
  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    await client.end();
  }
}

main();
