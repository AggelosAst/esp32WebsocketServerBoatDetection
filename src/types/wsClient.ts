export type WsClient = {
    id: string,
    name: string,
    connectedAt: number,
    lastPing: number,
    role: Role
}

export type Role = "master" | "slave"
