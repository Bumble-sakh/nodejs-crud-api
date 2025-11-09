import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Methods } from './constants';
import { store, UserData, syncStore } from './store/store';
import { isUserDataValid } from './helpers';
import { v4 as uuid, validate as idValidate } from 'uuid';

const requestListener = (req: IncomingMessage, res: ServerResponse) => {
  const [prefix, endpoint, id] = req.url.split('/').slice(1);
  const method = req.method;
  let isError = false;
  let userData: UserData;

  req.setEncoding('utf-8');
  req.on('data', (data) => {
    try {
      userData = JSON.parse(data);
    } catch (error) {
      req.emit('error', 500);
    }
  });

  req.on('end', () => {
    if (!isError) {
      if (prefix === 'api' && endpoint === 'users') {
        if (id) {
          switch (method) {
            case Methods.GET:
              if (!idValidate(id)) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    code: 400,
                    message: 'Bad request',
                  })
                );
                break;
              }
              if (store.find((user) => user.id === id)) {
                const user = store.find((user) => user.id === id);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(
                  JSON.stringify({
                    code: 200,
                    data: user,
                    message: 'OK',
                  })
                );
                break;
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(404);
                res.end(
                  JSON.stringify({
                    code: 404,
                    message: 'Not found',
                  })
                );
              }
              break;

            case Methods.PUT:
              if (!idValidate(id)) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    code: 400,
                    message: 'Bad request',
                  })
                );
                break;
              }
              if (store.find((user) => user.id === id)) {
                if (isUserDataValid(userData)) {
                  const index = store.findIndex((user) => user.id === id);
                  const [user] = store.splice(index, 1);
                  const newUser = Object.assign(user, userData);
                  store.push(newUser);
                  syncStore({ type: 'UPDATE', user: newUser });

                  res.setHeader('Content-Type', 'application/json');
                  res.writeHead(200);
                  res.end(
                    JSON.stringify({
                      code: 200,
                      data: newUser,
                      message: 'OK',
                    })
                  );
                  break;
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.writeHead(400);
                  res.end(
                    JSON.stringify({
                      code: 400,
                      message: 'Bad request',
                    })
                  );
                  break;
                }
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(404);
                res.end(
                  JSON.stringify({
                    code: 404,
                    message: 'Not found',
                  })
                );
              }

              break;

            case Methods.DELETE:
              if (!idValidate(id)) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    code: 400,
                    message: 'Bad request',
                  })
                );
                break;
              }
              if (store.find((user) => user.id === id)) {
                const index = store.findIndex((user) => user.id === id);
                store.splice(index, 1);
                syncStore({ type: 'DELETE', id });

                res.setHeader('Content-Type', 'application/json');
                res.writeHead(204);
                res.end();

                break;
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(404);
                res.end(
                  JSON.stringify({
                    code: 404,
                    message: 'Not found',
                  })
                );
              }
              break;

            default:
              res.setHeader('Content-Type', 'application/json');
              res.writeHead(400);
              res.end(
                JSON.stringify({
                  code: 400,
                  message: 'Bad request',
                })
              );
              break;
          }
        } else {
          switch (method) {
            case Methods.GET:
              res.setHeader('Content-Type', 'application/json');
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  code: 200,
                  data: store,
                  message: 'OK',
                })
              );
              break;

            case Methods.POST:
              if (isUserDataValid(userData)) {
                const user = { ...userData, id: uuid() };
                store.push(user);
                syncStore({ type: 'ADD', user });

                res.setHeader('Content-Type', 'application/json');
                res.writeHead(201);
                res.end(
                  JSON.stringify({
                    code: 201,
                    data: user,
                    message: 'Created',
                  })
                );
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    code: 400,
                    message: 'Bad request',
                  })
                );
              }
              break;

            default:
              res.setHeader('Content-Type', 'application/json');
              res.writeHead(400);
              res.end(
                JSON.stringify({
                  code: 400,
                  message: 'Bad request',
                })
              );
              break;
          }
        }
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(404);
        res.end(
          JSON.stringify({
            code: 404,
            message: 'Not found',
          })
        );
      }
    }
  });

  req.on('error', () => {
    isError = true;
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(500);
    res.end(
      JSON.stringify({
        code: 500,
        message: 'Internal Server Error',
      })
    );
  });
};

export const runServer = (port: number) => {
  const server = createServer(requestListener);

  server.listen(port, () => {
    console.log(`Server process ${process.pid} listen: ${port}`);
  });

  server.on('error', (error) => {
    console.log('-err1-');
    console.log(error);
  });
};
