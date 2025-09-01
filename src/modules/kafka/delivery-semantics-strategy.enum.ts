export enum DeliverySemantics {
    // The message is delivered at most once, and may be lost
    AT_MOST_ONCE = 'at-most-once',
    // The message is delivered at least once, but may be duplicated
    AT_LEAST_ONCE = 'at-least-once',
    // The message is delivered exactly once, with no duplicates or losses
    EXACTLY_ONCE = 'exactly-once',
}
