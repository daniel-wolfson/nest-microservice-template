// elasticsearch-logger.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchLoggerService {
    constructor(@Inject('ELASTICSEARCH_CLIENT') private readonly esClient: Client) {}

    async log(message: string, level: string = 'info') {
        await this.esClient.index({
            index: 'app-logs', // index в ELS
            document: {
                timestamp: new Date(),
                level,
                message,
            },
        });
    }
}
