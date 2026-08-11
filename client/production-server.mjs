import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import serverEntry from './dist/server/server.js'

const host = process.env.SSR_HOST ?? process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.SSR_PORT ?? process.env.PORT ?? 4173)

function createWebRequest(req) {
  const url = `http://${req.headers.host ?? `${host}:${port}`}${req.url ?? '/'}`
  const init = {
    method: req.method,
    headers: req.headers,
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req)
    init.duplex = 'half'
  }
  return new Request(url, init)
}

const httpServer = createServer(async (req, res) => {
  try {
    const response = await serverEntry.fetch(createWebRequest(req))
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res)
      return
    }
    res.end()
  } catch (error) {
    console.error('SSR request failed:', error)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

httpServer.listen(port, host, () => {
  console.log(`SSR server listening on http://${host}:${port}`)
})
