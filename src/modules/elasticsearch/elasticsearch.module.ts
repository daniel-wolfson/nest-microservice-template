import { Module } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Module({
    providers: [
        {
            provide: 'ELASTICSEARCH_CLIENT',
            useFactory: () => {
                return new Client({
                    node: 'http://localhost:9200', // TODO: Replace with your Elasticsearch node URL
                });
            },
        },
    ],
    exports: ['ELASTICSEARCH_CLIENT'],
})
export class ElasticsearchModule {}
