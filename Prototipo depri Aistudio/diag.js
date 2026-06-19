const fetch = require('node-fetch');
async function run() {
  const res = await fetch("http://localhost:3000/api/db/diagnose-all");
  console.log(await res.text());
}
run();
