const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.svtpjdaxikucgpflbeln:Supabase@123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`SELECT id, email FROM auth.users WHERE email = 'aabhishekg031@gmail.com'`);
    console.log('Auth Users:', res.rows);
  } catch (e) {
    console.error('DB Error:', e);
  } finally {
    await client.end();
  }
}

run();
