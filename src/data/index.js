// Production layer 
// All application data is persisted in postgreSQL through Prisma

const repo  = require("./prismaRepo");

console.log("[data] using PostgreSQL via Prisma");

module.exports = repo
