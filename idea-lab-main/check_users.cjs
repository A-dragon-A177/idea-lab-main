const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.svtpjdaxikucgpflbeln:Supabase@123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`SELECT id, email, name FROM users`);
    console.log('Users in DB:', res.rows);
  } catch (e) {
    console.error('DB Error:', e);
  } finally {
    await client.end();
  }
}

run();
