// Use actual Redis commands behind the Upstash REST protocol in integration tests.
// This intentionally does not emulate TTL, transactions, Lua, or sorted-set rules.
const http = require('node:http');
const Redis = require('ioredis');
exports.startRedisRest = async function (url) {
  const redis = new Redis(url, { maxRetriesPerRequest: 1 });
  await redis.ping();
  const server = http.createServer(async (req, res) => {
    try {
      let text = '';
      for await (const chunk of req) text += chunk;
      const data = JSON.parse(text);
      const encode = value => Array.isArray(value) ? value.map(encode)
        : typeof value === 'string' && req.headers['upstash-encoding'] === 'base64'
          ? Buffer.from(value).toString('base64') : value;
      const format = (result) => ({ result: encode(result) });
      const execute = async ([command, ...args]) => {
        const value = await redis.call(command, ...args);
        // ioredis applies its HGETALL object transformer even to call(). The
        // REST protocol uses the raw RESP flat list expected by Upstash.
        return String(command).toLowerCase() === 'hgetall' && value && !Array.isArray(value)
          ? Object.entries(value).flat() : value;
      };
      let result;
      if (req.url === '/multi-exec') {
        const multi = redis.multi();
        for (const [command, ...args] of data) multi.call(command, ...args);
        result = (await multi.exec()).map(([error, value]) => error ? {error:error.message} : format(value));
      } else if (req.url === '/pipeline') {
        result = await Promise.all(data.map(async command => format(await execute(command))));
      } else {
        result = format(await execute(data));
      }
      res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(result));
    } catch (error) { res.writeHead(400).end(JSON.stringify({error:error.message})); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { redis, url: `http://127.0.0.1:${server.address().port}`, close: async () => { await redis.quit(); await new Promise(resolve => server.close(resolve)); } };
};
