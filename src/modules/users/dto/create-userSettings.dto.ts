export class CreateUserSettingsDto {
    userId: string;
    receiveNotifications: boolean = false;
    receiveEmails: boolean = false;
}
