import { Router } from "express";
import { createBullBoard } from "@bull-board/api";
// @ts-expect-error — bull-board ships its own types but ESM resolution
// in tsx-watch occasionally trips on the subpath import
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { allQueues } from "../services/queue.js";

/**
 * Admin router — currently exposes Bull Board for queue inspection at
 * `/admin/queues`. No auth (this is a single-user demo); anyone who can
 * reach the API can see it. Add an auth middleware here in front of the
 * router before exposing the API publicly.
 */
export function createAdminRouter(): Router {
  const router = Router();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: allQueues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "Pulse · queues",
      },
    },
  });

  router.use("/queues", serverAdapter.getRouter());

  // Simple JSON summary endpoint for programmatic checks
  router.get("/queues.json", async (_req, res) => {
    const out = await Promise.all(
      allQueues.map(async (q) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getCompletedCount(),
          q.getFailedCount(),
          q.getDelayedCount(),
        ]);
        const repeatable = await q.getJobSchedulers().catch(() => []);
        return {
          name: q.name,
          counts: { waiting, active, completed, failed, delayed },
          schedulers: (repeatable as Array<{ id?: string; pattern?: string; name?: string }>).map(
            (r) => ({
              id: r.id,
              name: r.name,
              pattern: r.pattern,
            }),
          ),
        };
      }),
    );
    res.json({ queues: out, generatedAt: new Date().toISOString() });
  });

  return router;
}
