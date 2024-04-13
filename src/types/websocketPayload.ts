import {Role} from "./wsClient";

export type WebsocketPayload = {
    type: "ping" | "pong" | "register" | "send",
    role?: Role;
    name?: string;
    id?: string
    distance?: number
}