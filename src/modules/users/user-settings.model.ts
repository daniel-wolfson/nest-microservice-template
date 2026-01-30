import { Uuid } from '@elastic/elasticsearch/lib/api/types';

export class CreateUserSettingsInput {
    userId: Uuid;
    receiveNotifications: boolean;
    receiveEmails: boolean;
}
