import { createServer } from './app.js';

const port = Number(process.env.PORT ?? '3001');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
const server = createServer({ logger: (entry) => process.stdout.write(`${JSON.stringify({ event: 'api_request', ...entry })}\n`) });
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`${JSON.stringify({ event: 'api_started', mode: 'demo', host: '127.0.0.1', port })}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    const timer = setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000);
    timer.unref();
  });
}
