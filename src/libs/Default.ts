import {Default} from "../types/default";

export class DefaultClass {
    public static defaultClassInstance : DefaultClass
    constructor(options: Default) {
        // . . .
        DefaultClass.defaultClassInstance = this;
    }
}