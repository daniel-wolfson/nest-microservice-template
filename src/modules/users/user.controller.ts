import { Body, Controller, Get, Logger, Patch, Post, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticationGuard } from '../authentication/authentication.guard';
import { ResponseInterceptor } from '@core/interceptors/response.interceptor';
import { LanguageTransformInterceptor } from '@core/interceptors/language.interceptor';
import { Prisma, User } from '@prisma/client';
import { UserService } from './user.service';

@Controller('user')
@UseInterceptors(ResponseInterceptor)
@UseInterceptors(LanguageTransformInterceptor)
export class UserController {
    private readonly logger = new Logger('UserController');

    constructor(private readonly userService: UserService) {}

    @Get('')
    @UseGuards(AuthenticationGuard)
    async getMe(@Request() request: { userId: string }): Promise<User> {
        const { userId } = request;
        this.logger.log(`[GetMe]: user with id "${userId}" retrieving himself`);
        return this.userService.getUserById(userId);
    }

    @Patch('')
    @UseGuards(AuthenticationGuard)
    async updateUser(
        @Request() request: { userId: string },
        @Body() updateUserRequest: Prisma.UserUpdateInput,
    ): Promise<User> {
        const { userId } = request;
        this.logger.log(`[UpdateUser]: user with id "${userId}" updating itself`);
        return this.userService.updateUser(userId, updateUserRequest);
    }
}
