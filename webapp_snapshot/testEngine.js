require('ts-node').register({compilerOptions:{module:'commonjs'}});
const { runExtrasEngine } = require('./src/lib/extrasEngine.ts');
runExtrasEngine().then(console.log).catch(console.error);
