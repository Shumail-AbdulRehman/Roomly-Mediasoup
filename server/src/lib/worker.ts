import * as mediasoup from "mediasoup";
import { Worker } from "mediasoup/types";
import { Router } from "mediasoup/types";
import { config } from "../config/config.js";

export const workers: Worker[] = [];
let nextWorkerIndex: number = 0;

export const createWorkers = async () => {
  for (let i = 0; i < config.mediasoup.numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    workers.push(worker);

    worker.on("died", () => {
      console.error(
        "mediasoup worker died, exiting in 2 seconds ... [pid:%d]",
        worker.pid,
      );
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    });
  }
};

export function getNextWorker(): Worker {
  const worker = workers[nextWorkerIndex];

  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

  return worker;
}

export async function createRouterForWorker(worker: Worker): Promise<Router> {
  const mediaCodecs = config.mediasoup.router.mediaCodecs;
  const mediasoupRouter = await worker.createRouter({ mediaCodecs });
  return mediasoupRouter;
}