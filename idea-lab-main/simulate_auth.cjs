const http = require('http');

// The token provided by the user in the logs!
const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/users/me',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImU4NDZiOTQ2LTYzNTgtNGM0YS04ZmYxLTlkOTlmYzAwNzBlYSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZW1haWwiOiJhYWJoaXNoZWtnMDMxQGdtYWlsLmNvbSIsImV4cCI6MTc3NDYxNDk3MSwiaWF0IjoxNzQzMDgxMzcxLCJwaG9uZSI6IiIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic2Vzc2lvbl9pZCI6IjY5MWQxYWFhLTc5MjMtNDA4Mi1hMWFiLWUyZGFkYWVmMWIzNyIsInN1YiI6Ijg4MGJkMzg0LTY2MGUtNDBmOC04NmYwLTU0NjY5NTBjMDBjIiwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9saDNvZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS2wwakcxeDFfX2lBdl9kYWlGOUkxeVBRNVpabmJ0eUVlM0p6UE95RnpfUXc9czk2LWMiLCJlbWFpbCI6ImFhYmhpc2hla2cwMzFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IkFiaGlzaGVrIEciLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYW1lIjoiQWJoaXNoZWsgRyIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NLbDBqRzF4MV9faUF2X2RhaUY5STF5UFE1WlpuYnR5RWUzSnpQT3lGel9Rdz1zOTYtYyIsInByb3ZpZGVyX2lkIjoiMTE1ODkxNzk0ODg1OTUzMzg0MDM4Iiwic3ViIjoiMTE1ODkxNzk0ODg1OTUzMzg0MDM4In19.j74t2xY1BwK4X1Z0X3Q9P2U8I8O6N4_7F9E4W1UdPt8aiqbjBWjlSZrJtoiXbcnkwoq3rnTnkZqFhcAArGfCnQ'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => { console.log(`BODY: ${rawData}`); });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
