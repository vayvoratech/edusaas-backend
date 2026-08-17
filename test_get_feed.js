const repo = require('./src/data/prismaRepo');

async function testGetFeed() {
  const feed = await repo.communityPosts.getFeed();
  console.log('FEED RESULT:', JSON.stringify(feed, null, 2));
}

testGetFeed().catch(console.error);
