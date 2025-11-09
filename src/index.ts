import { argv } from "process";
import os from "os";
import cluster from "cluster";
import dotenv from "dotenv";
import { runServer } from "./server";
import { runBalancer } from "./balancer";
import { applyStoreAction, StoreAction } from "./store/store";

dotenv.config();

const port = Number(process.env.PORT) || 4000;

const once = () => {
  runServer(port);
};

const multi = () => {
  const cpus = os.cpus().length;
  const workersCount = cpus - 1;

  if (cluster.isPrimary) {
    runBalancer(port, workersCount);

    for (let i = 1; i <= workersCount; i++) {
      const worker = cluster.fork({ crud_api_port: port + i });

      // Обработка сообщений от воркеров для синхронизации
      worker.on("message", (action: StoreAction) => {
        // Рассылаем действие всем остальным воркерам
        for (const id in cluster.workers) {
          if (cluster.workers[id]?.id !== worker.id) {
            cluster.workers[id]?.send(action);
          }
        }
      });
    }
  } else {
    const workerPort = Number(process.env.crud_api_port);

    // Обработка сообщений от мастер-процесса для синхронизации
    process.on("message", (action: StoreAction) => {
      applyStoreAction(action);
    });

    runServer(workerPort);
  }
};

if (argv[2] === "--multi") {
  multi();
} else {
  once();
}
