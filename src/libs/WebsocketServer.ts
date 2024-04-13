import WebSocket, {WebSocketServer} from "ws";
import {WebsocketPayload} from "../types/websocketPayload";
import {Role, WsClient} from "../types/wsClient";
import {IncomingMessage} from "node:http";
import * as crypto from "crypto";
export class WebsocketServer {
    public static websocketInstance: WebsocketServer
    private readonly wsServer: WebSocketServer
    public readonly registeredClients : WsClient[] = []

    public constructor(server: any) {
        this.wsServer = new WebSocketServer({
            server: server
        })
        WebsocketServer.websocketInstance = this
        this.wsServer.on("connection", this.onConnection.bind(this));
        this.checkConnections();
    }

    private async checkConnections(): Promise<void> {
            setInterval(() => {
                if (this.registeredClients.length > 0) {
                    for (const client of this.registeredClients) {
                        if (Date.now() - client.lastPing > 5000) {
                            console.log(`Client with role ${client.role} has not sent back a ping signal, registering as dead`)
                            for (const wsClient of this.wsServer.clients) {
                                if (wsClient.hasOwnProperty("wsData")) {
                                    if ((wsClient as any)["wsData"].id == client.id) {
                                        const removedClient: WsClient[] = this.registeredClients.splice(this.registeredClients.indexOf(client), 1)
                                        if (wsClient) {
                                            wsClient.send(JSON.stringify({
                                                type: "register",
                                                role: removedClient.at(0)!.role,
                                                name: removedClient.at(0)!.name,
                                                actionCode: "DEAD"
                                            }))
                                            wsClient.terminate();
                                        }
                                        break
                                    }
                                }
                            }
                        }
                    }
                }
            }, 5000)
    }



    private async isRegistered(targetId: string): Promise<WsClient | boolean> {
        return new Promise(async (resolve, reject) => {
            const registeredClientId: number = this.registeredClients.findIndex((client: WsClient) => client.id == targetId);
            if (registeredClientId == -1) {
                resolve(false)
            }
        })
    }
    private async isRegisteredWithRole(role: Role): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            if (role == "master") {
                const registeredRole = this.registeredClients.findIndex((client: WsClient) => client.role == role)
                if (registeredRole == -1) {
                    resolve(false)
                } else {
                    resolve(true)
                }
            } else {
                resolve(false)
            }
        })
    }

    private async onMessage(ws: WebSocket, message: WebSocket.RawData): Promise<void> {
        let payload!: WebsocketPayload
        try {
            payload = JSON.parse(message.toString())
        } catch (e) {
            ws.send(JSON.stringify({
                message: "Invalid payload",
                error: e,
                actionCode: "INVALID_PAYLOAD"
            }))
            return
        }
        if (payload.type) {
            switch (payload.type) {
                case "send":
                    if (ws.hasOwnProperty("wsData")) {
                        const registeredClient = this.registeredClients.findIndex((client : WsClient) => client.id == (ws as any)["wsData"].id)
                        if (registeredClient != -1) {
                             if (this.registeredClients[registeredClient].role == "slave") {
                                for (const wsClient of this.wsServer.clients) {
                                    if ((wsClient as any)["wsData"] && (wsClient as any)["wsData"].role as Role == "master") {
                                        wsClient.send(JSON.stringify({
                                            type: "RECEIVE_SIGNAL",
                                            detectedSensorName: this.registeredClients[registeredClient].name,
                                            sensorId: this.registeredClients[registeredClient].id,
                                            distance: payload.distance
                                        }))
                                        break
                                    }
                                }
                            }
                        }
                    }

                    break;
                case "ping":
                 if (payload.id) {
                     const registeredClient = this.registeredClients.findIndex((client : WsClient) => client.id == payload.id)
                     if (registeredClient != -1) {
                         this.registeredClients[registeredClient].lastPing = Date.now()
                         ws.send(JSON.stringify({
                             type: "PONG",
                             actionCode: "PONG"
                         }))
                     }
                 }

                    break;
                case "pong":
                    break;
                case "register":
                    console.log(payload)
                    if (payload.role && payload.name) {
                        const isRegistered: boolean = await this.isRegisteredWithRole(payload.role)
                        if (isRegistered) {
                            return ws.send(JSON.stringify({
                                message: `Role role = ${payload.role} is registered already.`,
                                actionCode: "REGISTERED_ALREADY",
                                type : "REGISTER",
                            }))
                        } else {
                            const randomId: string = crypto.randomUUID()
                            this.registeredClients.push({
                                id: randomId,
                                role: payload.role,
                                connectedAt: Date.now(),
                                name: payload.name,
                                lastPing: Date.now()
                            })
                            Object.defineProperty(ws, "wsData", {
                                value: {
                                    id: randomId,
                                    name: payload.name,
                                    connectedAt: Date.now(),
                                    role: payload.role
                                },
                                configurable: true,
                                writable: true
                            })
                            ws.send(JSON.stringify({
                                message: "Registered successfully",
                                actionCode: "REGISTERED_SUCCESSFULLY",
                                type : "REGISTER",
                                id: randomId,
                                role: payload.role
                            }))
                            return
                        }
                    }
                    break;

            }
        }
    }

    private async onConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
        ws.on("close", () => this.onDisconnection(ws));
        ws.on("message", (message: WebSocket.RawData) => this.onMessage(ws, message));
        console.log(`[WEBSOCKET]: Client connected.`)
    }

    private onDisconnection(ws: WebSocket): void {
        console.log("Disconnected")
        const registeredClient = this.registeredClients.findIndex((client : WsClient) => client.id == (ws as any)["wsData"].id)
        if (registeredClient != -1) {
            this.registeredClients.splice(registeredClient, 1)
        }
    }
}