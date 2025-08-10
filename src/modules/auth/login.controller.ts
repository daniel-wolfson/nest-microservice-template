import { Controller, Request, Post, UseGuards, Body, Get, BadRequestException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { validate } from 'class-validator';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
    private readonly logger = new Logger(LoginController.name);

    constructor(private readonly usersService: UsersService, private readonly authService: AuthService) {}

    @UseGuards(AuthGuard('local'))
    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 400, description: 'Validation failed' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Request() req, @Body() loginDto: LoginDto) {
        // Additional explicit validation (though global ValidationPipe should handle this)
        const validationErrors = await validate(loginDto);
        if (validationErrors.length > 0) {
            this.logger.warn(`login: Validation failed for email: ${loginDto.email}`, { errors: validationErrors });

            const formattedErrors = validationErrors.reduce((acc, error) => {
                acc[error.property] = Object.values(error.constraints || {});
                return acc;
            }, {} as Record<string, string[]>);

            throw new BadRequestException({ success: false, message: 'Validation failed', errors: formattedErrors });
        }

        try {
            const result = await this.authService.login(req.user);
            this.logger.log(`login: Successful login for email: ${loginDto.email}`);
            return result;
        } catch (error) {
            this.logger.error(
                `login: Login failed for email: ${loginDto.email}`,
                error instanceof Error ? error.stack : String(error),
            );
            throw error;
        }
    }

    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @Post('user')
    @ApiOperation({ summary: 'get User login' })
    @ApiResponse({ status: 200, description: 'Success' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async user(@Request() req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            throw new Error('No token provided');
        }
        const payload = await this.authService.verifyToken(token);
        const user = await this.usersService.findOne(payload.email);
        const { password, userId, ...userDetails } = user;
        return userDetails;
    }

    // Add this to your controller or create a middleware
    @Get('debug-headers')
    debugHeaders(@Request() req) {
        console.log('All headers:', JSON.stringify(req.headers, null, 2));
        console.log('Authorization header:', req.headers.authorization);
        console.log('Raw headers object:', req.headers);
        return { headers: req.headers };
    }
}
