import "dotenv/config";
import { createApp } from "./app.js";
import { connectMongo } from "./db/mongoose.js";

const port = Number(process.env.PORT ?? 4000);

async function main() {
  await connectMongo(process.env.MONGO_URL ?? "mongodb://localhost:27017/pulse");
  const app = createApp();
  app.listen(port, () => {
    console.log(`[api] listening on http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
