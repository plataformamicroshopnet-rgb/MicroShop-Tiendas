const session = { user: { permissions: 'old' } };
const { user } = session;
session.user.permissions = 'new';
console.log(user.permissions);
