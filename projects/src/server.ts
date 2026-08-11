import { createServer } from 'http';
import { execSync } from 'child_process';
import { parse } from 'url';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// 在 Next.js 启动前，清理任何残留的静态 serve 进程
// （沙箱在 tsx watch 重启时可能短暂让出 5000 端口，被外部 'serve' 抢占）
function killStaleServeProcesses() {
  try {
    // 杀掉所有占用 5000 端口的进程
    const portPids = execSync(
      `ss -H -lntp 2>/dev/null | awk '$4 ~ ":${port}$"' | grep -o 'pid=[0-9]*' | cut -d= -f2`,
      { encoding: 'utf-8' }
    ).trim();
    if (portPids) {
      portPids.split('\n').forEach(p => {
        try { process.kill(parseInt(p, 10), 'SIGKILL'); } catch {}
      });
    }
    // 杀掉所有 'serve -l 5000' 进程（无论是否在端口上）
    const servePids = execSync(
      `pgrep -f "serve.*-l 5000" || true`,
      { encoding: 'utf-8' }
    ).trim();
    if (servePids) {
      servePids.split('\n').forEach(p => {
        try { process.kill(parseInt(p, 10), 'SIGKILL'); } catch {}
      });
    }
  } catch {}
}

killStaleServeProcesses();

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  // 端口冲突时自动重试（serve 抢先时等 200ms 再试，最多 5 次）
  let retries = 0;
  const tryListen = () => {
    server.listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.COZE_PROJECT_ENV
        }`,
      );
    });
  };
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && retries < 5) {
      retries++;
      console.warn(`Port ${port} in use, retry ${retries}/5...`);
      killStaleServeProcesses();
      setTimeout(tryListen, 200);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  tryListen();
});
