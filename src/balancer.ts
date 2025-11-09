import { createServer, IncomingMessage, ServerResponse } from "http";
import { request } from "http";

export const runBalancer = (port: number, workersCount: number) => {
  const workerPorts: number[] = [];
  for (let i = 1; i <= workersCount; i++) {
    workerPorts.push(port + i);
  }

  let currentWorkerIndex = 0;

  const getNextWorkerPort = (): number => {
    const port = workerPorts[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % workerPorts.length;
    return port;
  };

  const proxyRequest = (req: IncomingMessage, res: ServerResponse) => {
    const targetPort = getNextWorkerPort();

    const options = {
      hostname: "localhost",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (error) => {
      res.writeHead(500);
      res.end(
        JSON.stringify({
          code: 500,
          message: "Internal Server Error",
        })
      );
    });

    req.pipe(proxyReq);
  };

  const server = createServer(proxyRequest);

  server.listen(port, () => {
    console.log(`Load balancer process ${process.pid} listen: ${port}`);
  });

  server.on("error", (error) => {
    console.error("Load balancer error:", error);
  });
};
