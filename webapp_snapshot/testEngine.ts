import { runExtrasEngine } from './src/lib/extrasEngine'

async function tryIt() {
  try {
    const res = await runExtrasEngine();
    console.log("SUCCESS:", res);
  } catch (err: any) {
    if (err.name) console.log("NAME:", err.name);
    if (err.message) console.log("MSG:", err.message);
    if (err.code) console.log("CODE:", err.code);
    if (err.meta) console.log("META:", JSON.stringify(err.meta));
  }
}

tryIt();
