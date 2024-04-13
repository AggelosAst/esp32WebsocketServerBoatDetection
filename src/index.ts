import {Server} from "./libs/Server";


const server: Server = new Server({
    port: 4040
})

server.startServer()