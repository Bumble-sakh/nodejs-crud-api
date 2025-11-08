import { argv } from "process";
import os from "os";
import cluster from "cluster";
import dotenv from "dotenv";
import { runServer } from "./server";
import { runBalancer } from "./balancer";

dotenv.config();

const port = Number(process.env.PORT) || 4000;

const once = () => {
  runServer(port);
};

const multi = () => {
  const cpus = os.cpus().length;

  if (cluster.isMaster) {
    runBalancer(port);

    for (let i = 1; i <= cpus; i++) {
      cluster.fork({ crud_api_port: port + i });
    }
  } else {
    const port = Number(process.env.crud_api_port);
    runServer(port);
  }
};

if (argv[2] === "--multi") {
  multi();
} else {
  once();
}
