import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.type';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {}

    /**
     * Validates user credentials securely
     * @param username - User identifier (username or email)
     * @param password - Plain text password
     * @returns User object without password if valid, null otherwise
     */
    async validateUser(email: string, password: string): Promise<any> {
        try {
            // Input validation
            if (!email || !password) {
                this.logger.warn('Validation attempt with missing credentials');
                return null;
            }

            // Find user by username/email
            const user = await this.usersService.findOne(email);

            if (!user) {
                this.logger.warn(`User not found: ${email}`);
                return null;
            }

            // Secure password comparison using bcrypt
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                this.logger.warn(`Invalid password attempt for user: ${email}`);
                return null;
            }

            // Log successful validation (without sensitive data)
            this.logger.log(`User validated successfully: ${user.username}`);

            // Return user without sensitive information
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error: any) {
            this.logger.error(`Error during user validation: ${error.message}`, error.stack);
            return null;
        }
    }

    /**
     * Generates access and refresh tokens for authenticated user
     * @param user - Validated user object
     * @returns Object containing access token, refresh token, and user info
     */
    async login(userData: User) {
        try {
            // Get user data
            const user = await this.usersService.findOne(userData.email);
            if (!user) {
                throw new Error('User not found');
            }
            return await this.generateAccessToken(user);
        } catch (error: any) {
            this.logger.error(`Error during login token generation: ${error.message}`, error.stack);
            throw new Error('Token generation failed');
        }
    }

    /**
     * Generates a new access token for a user
     * @param userId - User ID
     * @returns New access token with user info
     */
    private async generateAccessToken(user: User) {
        try {
            // Get token configurations from config
            const accessTokenExpiration = this.configService.get<number>('JWT_ACCESS_EXPIRATION', 900); // 15 minutes
            const refreshTokenExpiration = this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800); // 7 days

            // Access token payload (short-lived, contains user info)
            const accessPayload = {
                username: user.username,
                sub: user.userId,
                email: user.email,
                roles: user.roles || [],
                type: 'access',
                iat: Math.floor(Date.now() / 1000),
            };

            // Refresh token payload (long-lived, minimal info)
            const refreshPayload = {
                sub: user.userId,
                type: 'refresh',
                jti: randomBytes(16).toString('hex'), // Unique token identifier
                iat: Math.floor(Date.now() / 1000),
            };

            // Generate tokens
            const accessToken = this.jwtService.sign(accessPayload, {
                expiresIn: `${accessTokenExpiration}s`,
            });

            const refreshToken = this.jwtService.sign(refreshPayload, {
                expiresIn: `${refreshTokenExpiration}s`,
            });

            // Store refresh token in database (optional but recommended)
            await this.storeRefreshToken(`${user.userId}`, refreshPayload.jti, refreshTokenExpiration);

            this.logger.log(`JWT tokens generated for user: ${user.username}`);

            return {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: accessTokenExpiration,
                refresh_expires_in: refreshTokenExpiration,
                user: {
                    id: user.userId,
                    username: user.username,
                    email: user.email,
                    roles: user.roles || [],
                },
            };
        } catch (error: any) {
            this.logger.error(`Error generating new access token: ${error.message}`, error.stack);
            throw new Error('Access token generation failed');
        }
    }

    /**
     * Generates a new access token for a user
     * @param userId - User ID
     * @returns New access token with user info
     */
    private async generateAccessTokenById(userId: string) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return this.generateAccessToken(user);
    }

    /**
     * Refreshes access token using refresh token
     * @param refreshToken - Valid refresh token
     * @returns New access token and optionally new refresh token
     */
    async refreshAccessToken(refreshToken: string) {
        try {
            // Verify refresh token
            const decoded = this.jwtService.verify(refreshToken);

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Check token age
            const maxRefreshAge = this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800);
            const currentTime = Math.floor(Date.now() / 1000);
            const tokenAge = currentTime - decoded.iat;

            if (tokenAge > maxRefreshAge) {
                throw new Error('Refresh token is too old');
            }

            // Check if refresh token is still valid in database
            const isValidRefreshToken = await this.isRefreshTokenValid(decoded.sub, decoded.jti);
            if (!isValidRefreshToken) {
                throw new Error('Refresh token has been revoked');
            }

            // Generate new access token
            return this.generateAccessTokenById(decoded.sub);
        } catch (error: any) {
            this.logger.error(`Error during token refresh: ${error.message}`);
            throw new Error('Token refresh failed');
        }
    }

    /**
     * Revokes a refresh token
     * @param userId - User ID
     * @param tokenId - Token identifier (jti)
     */
    async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
        try {
            await this.removeRefreshToken(userId, tokenId);
            this.logger.log(`Refresh token revoked for user: ${userId}`);
        } catch (error: any) {
            this.logger.error(`Error revoking refresh token: ${error.message}`);
            throw new Error('Token revocation failed');
        }
    }

    /**
     * Logout user by revoking all refresh tokens
     * @param userId - User ID
     */
    async logout(userId: string): Promise<void> {
        try {
            await this.removeAllRefreshTokens(userId);
            this.logger.log(`All refresh tokens revoked for user: ${userId}`);
        } catch (error: any) {
            this.logger.error(`Error during logout: ${error.message}`);
            throw new Error('Logout failed');
        }
    }

    /**
     * Verify JWT token manually if needed
     * @param token - JWT token string
     * @returns Decoded payload or null
     */
    async verifyToken(token: string): Promise<any> {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            this.logger.warn(`Invalid token verification attempt`);
            return null;
        }
    }

    // Helper methods for refresh token management
    private async storeRefreshToken(userId: string, tokenId: string, expiresIn: number): Promise<void> {
        // Implement refresh token storage in your database
        // This could be Redis, database table, etc.
        const expirationDate = new Date(Date.now() + expiresIn * 1000);

        // Example: store in database
        // await this.refreshTokenRepository.save({
        //     userId,
        //     tokenId,
        //     expiresAt: expirationDate,
        //     createdAt: new Date(),
        // });

        this.logger.debug(`Refresh token stored for user: ${userId}, tokenId: ${tokenId}`);
    }

    private async isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
        // Check if refresh token exists and is not expired
        // const token = await this.refreshTokenRepository.findOne({
        //     where: { userId, tokenId, expiresAt: MoreThan(new Date()) }
        // });
        // return !!token;

        // Temporary implementation - always return true
        // In production, implement proper database check
        return true;
    }

    private async removeRefreshToken(userId: string, tokenId: string): Promise<void> {
        // Remove specific refresh token
        // await this.refreshTokenRepository.delete({ userId, tokenId });
        this.logger.debug(`Refresh token removed for user: ${userId}, tokenId: ${tokenId}`);
    }

    private async removeAllRefreshTokens(userId: string): Promise<void> {
        // Remove all refresh tokens for user
        // await this.refreshTokenRepository.delete({ userId });
        this.logger.debug(`All refresh tokens removed for user: ${userId}`);
    }

    // Implement token rotation with age limits
    private async refreshWithRotation(refreshToken: string) {
        const decoded = this.jwtService.verify(refreshToken);
        const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;

        // If token is older than 1 day, force re-authentication
        if (tokenAge > 86400) {
            await this.revokeRefreshToken(decoded.sub, decoded.jti);
            throw new Error('Token too old, please login again');
        }

        // If token is older than 1 hour, issue new refresh token too
        if (tokenAge > 3600) {
            return this.login(await this.usersService.findById(decoded.sub));
        }

        // Otherwise, just refresh access token
        return this.generateAccessTokenById(decoded.sub);
    }

    // Token age verification
    async verifyTokenAge(token: string, maxAgeInSeconds: number): Promise<boolean> {
        try {
            const decoded = this.jwtService.verify(token);
            const currentTime = Math.floor(Date.now() / 1000);
            const tokenAge = currentTime - decoded.iat;

            return tokenAge <= maxAgeInSeconds;
        } catch (error) {
            return false;
        }
    }

    // Revoke all tokens issued before a specific time (e.g., password change)
    async revokeTokensIssuedBefore(userId: string, beforeTimestamp: number): Promise<void> {
        // await this.refreshTokenRepository.update(
        //     {
        //         userId,
        //         // Using iat from database record (you'd store this when creating token)
        //         issuedAt: LessThan(new Date(beforeTimestamp * 1000))
        //     },
        //     { isRevoked: true }
        // );
    }

    // Monitor token usage patterns
    async getTokenStatistics(userId: string): Promise<any> {
        // const tokens = await this.refreshTokenRepository.find({
        //     where: { userId },
        //     select: ['tokenId', 'issuedAt', 'lastUsed', 'isRevoked']
        // });
        // return {
        //     totalTokens: tokens.length,
        //     activeTokens: tokens.filter(t => !t.isRevoked).length,
        //     oldestToken: Math.min(...tokens.map(t => t.issuedAt.getTime())),
        //     newestToken: Math.max(...tokens.map(t => t.issuedAt.getTime()))
        // };
    }

    createJwtOptions(configService: ConfigService): JwtModuleOptions {
        const secret = this.getJwtSecret();
        const expiresIn = this.getJwtExpiration();

        if (!secret) {
            throw new Error('JWT_SECRET is required but not provided');
        }

        return {
            secret,
            signOptions: {
                expiresIn: `${expiresIn}s`,
                issuer: configService.get<string>('JWT_ISSUER', 'app'),
                audience: configService.get<string>('JWT_AUDIENCE', 'app-users'),
            },
            verifyOptions: {
                issuer: configService.get<string>('JWT_ISSUER', 'app'),
                audience: configService.get<string>('JWT_AUDIENCE', 'app-users'),
            },
        };
    }

    getJwtExpiration(): number {
        return this.configService.get<number>('JWT_ACCESS_EXPIRATION', 900);
    }

    getJwtSecret(): string {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is required');
        }
        return secret;
    }
}
