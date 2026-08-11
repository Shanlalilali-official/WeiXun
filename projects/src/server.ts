import { createServer } from 'node:http';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = Number.parseInt(process.env.PORT || '5000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (request, response) => {
    try {
      await handle(request, response);
    } catch (error) {
      console.error('Request handling failed', request.url, error);
      response.statusCode = 500;
      response.end('Internal server error');
    }
  });

  server.once('error', (error) => {
    console.error(`Unable to start server on ${hostname}:${port}`, error);
    process.exit(1);
  });
  server.listen(port, hostname, () => {
    console.log(`> Server listening at http://${hostname}:${port} (${dev ? 'development' : 'production'})`);
  });
});
