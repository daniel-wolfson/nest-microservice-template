import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/user.service.old';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './services/authentication.service';
import { LoginRequest } from './dto/login.request';
import { LanguageService } from '@/core/services/language.service';

describe('AuthenticationController', () => {
    let controller: AuthenticationController;
    let authService: AuthenticationService;

    const mockAuthService = {
        login: jest.fn(),
        register: jest.fn(),
        refreshToken: jest.fn(),
        validateUser: jest.fn(),
        verifyToken: jest.fn(),
    };

    const mockUsersService = {
        findOne: jest.fn(),
    };

    const mockLanguageService = {
        getLanguage: jest.fn(),
        setLanguage: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthenticationController],
            providers: [
                {
                    provide: AuthenticationService,
                    useValue: mockAuthService,
                },
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: LanguageService,
                    useValue: mockLanguageService,
                },
            ],
        }).compile();

        controller = module.get<AuthenticationController>(AuthenticationController);
        authService = module.get<AuthenticationService>(AuthenticationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const mockUser = {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
        };

        const mockRequest = {
            email: 'test@example.com',
            password: '123456',
        } as LoginRequest;

        it('should successfully login with valid credentials', async () => {
            const expectedResult = {
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                user: mockUser,
            };

            mockAuthService.login.mockResolvedValue(expectedResult);

            const result = await controller.login(mockRequest);

            expect(result).toEqual(expectedResult);
            expect(mockAuthService.login).toHaveBeenCalledWith(mockRequest);
        });

        it('should handle authentication service errors', async () => {
            mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

            await expect(controller.login(mockRequest)).rejects.toThrow(UnauthorizedException);
            expect(mockAuthService.login).toHaveBeenCalledWith(mockRequest);
        });
    });
});
