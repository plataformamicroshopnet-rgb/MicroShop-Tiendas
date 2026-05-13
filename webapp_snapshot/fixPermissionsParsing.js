const fs = require('fs');
let content = fs.readFileSync('src/lib/permissions.ts', 'utf-8');

// Parse permissions if they are a string
content = content.replace(
  "const activePerms = (user.permissions !== null && Array.isArray(user.permissions))",
  `
  let parsedPerms = user.permissions;
  if (typeof user.permissions === 'string') {
    try { parsedPerms = JSON.parse(user.permissions); } catch(e) {}
  }
  const activePerms = (parsedPerms !== null && Array.isArray(parsedPerms)) ? parsedPerms`
);

// We need to do this for both can and canView.
content = content.replace(
  "const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) \n      ? user.permissions \n      : getDefaultPermissions(user.role);",
  `
    let parsedPerms = user.permissions;
    if (typeof user.permissions === 'string') {
      try { parsedPerms = JSON.parse(user.permissions); } catch(e) {}
    }
    const activePerms = (parsedPerms !== null && Array.isArray(parsedPerms)) 
      ? parsedPerms 
      : getDefaultPermissions(user.role);`
);

fs.writeFileSync('src/lib/permissions.ts', content, 'utf-8');
