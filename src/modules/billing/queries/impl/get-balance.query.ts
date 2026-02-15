import { Query } from "@nestjs/cqrs";
import { BalanceResponseDto } from "../../dto/balance-response.dto";

export class GetBalanceQuery extends Query<BalanceResponseDto> {
    constructor(public readonly userId: string) {
        super();
    }
}
