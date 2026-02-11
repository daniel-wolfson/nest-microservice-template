export class UserBalanceLowEvent {
    constructor(
        public readonly userId: string,
        public readonly currentBalance: number,
        public readonly threshold: number,
    ) {}
}
