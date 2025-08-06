import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import passport from 'passport';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
    constructor(private readonly usersService: UsersService, private readonly authService: AuthService) {}

    @UseGuards(AuthGuard('local'))
    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Request() req, @Body() loginDto: LoginDto) {
        return this.authService.login(req.user);
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
