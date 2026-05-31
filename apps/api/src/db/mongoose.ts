import mongoose from "mongoose";

export async function connectMongo(url: string): Promise<void> {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(url, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[api] mongo connected: ${url.replace(/\/\/[^@]*@/, "//***@")}`);
  } catch (err) {
    console.error("[api] mongo connection failed:", err);
    throw err;
  }
}
