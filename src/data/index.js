// Repository toggle. Set USE_DB=true in .env to use Postgres via Prisma; otherwise in-memory.
const useDb = (process.env.USE_DB || "").toLowerCase() === "true";

let repo;
if (useDb) {
  // eslint-disable-next-line global-require
  repo = require("./prismaRepo");
  console.log("[data] using PostgreSQL via Prisma");
} else {
  // eslint-disable-next-line global-require
  repo = require("./memoryRepo");
  console.log("[data] using in-memory store");
}

module.exports = repo;
