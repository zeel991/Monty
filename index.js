require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { TwitterApi } = require("twitter-api-v2");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const roClient = twitterClient.readOnly;

let lastTweetId = null;

async function fetchLatestTweet() {
  console.log("🔄 Checking for new tweets...");

  try {
    const user = await roClient.v2.userByUsername(process.env.TWITTER_USERNAME);
    const userId = user.data.id;
    console.log(`✅ Found Twitter user: ${user.data.username} (ID: ${userId})`);

    const tweets = await roClient.v2.userTimeline(userId, {
      max_results: 5,
      exclude: "replies",
      expansions: ["attachments.media_keys"],
      "tweet.fields": ["created_at"],
    });

    const latestTweet = tweets.data.data?.[0];
    console.log("📝 Latest tweet data:", latestTweet);

    if (!latestTweet) {
      console.log("⚠️ No tweets found for this user.");
      return;
    }

    if (latestTweet.id === lastTweetId) {
      console.log("⏸ No new tweet since last check.");
      return;
    }

    lastTweetId = latestTweet.id;
    const tweetLink = `https://twitter.com/${process.env.TWITTER_USERNAME}/status/${latestTweet.id}`;
    console.log("🔗 New tweet link:", tweetLink);

    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    console.log(`✅ Found Discord channel: ${channel.name}`);

    await channel.send(`New tweet from ${process.env.TWITTER_USERNAME}:\n${tweetLink}`);
    console.log("✅ Tweet sent to Discord.");

  } catch (err) {
    if (err.code === 429) {
      const resetTimestamp = err.rateLimit?.reset * 1000;
      const resetTime = resetTimestamp ? new Date(resetTimestamp).toLocaleTimeString() : "unknown";
      console.warn(`⏳ Rate limit hit. Retry after: ${resetTime}`);
    } else {
      console.error("❌ Error fetching tweet or sending to Discord:", err);
    }
  }
}

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  fetchLatestTweet(); 
  setInterval(fetchLatestTweet, 20 * 60 * 1000); 
});

client.login(process.env.DISCORD_TOKEN);
