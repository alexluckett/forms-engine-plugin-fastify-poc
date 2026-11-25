import { createServer, port } from './create-server.js'

const server = await createServer()

await server.listen({ port })
server.log.info(`Open http://localhost:${port}/example-form`)
