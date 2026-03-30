const resendApiKey = 're_CSo6h4GZ_2KeTwb7Qhc1VSMsRmL2i4Dc5';

async function testResend() {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Neesh AI <onboarding@resend.dev>',
        to: 'test_user_xyz_123@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>'
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testResend();
