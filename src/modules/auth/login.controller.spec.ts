import { Test, TestingModule } from '@nestjs/testing';
import { LoginController } from './login.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ValidationService } from './validation.service';
import { LoginDto } from './dto/login.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('LoginController', () => {
    let controller: LoginController;
    let authService: AuthService;
    let validationService: ValidationService;
    let usersService: UsersService;

    const mockAuthService = {
        login: jest.fn(),
        validateUser: jest.fn(),
        verifyToken: jest.fn(),
    };

    const mockUsersService = {
        findOne: jest.fn(),
    };

    const mockValidationService = {
        validateDto: jest.fn(),
        validateDtoSilent: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [LoginController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: ValidationService,
                    useValue: mockValidationService,
                },
            ],
        }).compile();

        controller = module.get<LoginController>(LoginController);
        authService = module.get<AuthService>(AuthService);
        validationService = module.get<ValidationService>(ValidationService);
        usersService = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const validLoginDto: LoginDto = {
            email: 'test@example.com',
            password: 'ValidPassword123!',
        };

        const mockUser = {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
        };

        const mockRequest = {
            user: mockUser,
        };

        it('should successfully login with valid credentials', async () => {
            const expectedResult = {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                user: mockUser,
            };

            mockAuthService.login.mockResolvedValue(expectedResult);

            const result = await controller.login(mockRequest, validLoginDto);

            expect(result).toEqual(expectedResult);
            expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
        });

        it('should throw BadRequestException for invalid email format', async () => {
            const invalidLoginDto = {
                email: 'invalid-email',
                password: 'ValidPassword123!',
            };

            // Mock validation error response
            const validationErrors = [
                {
                    property: 'email',
                    constraints: {
                        isEmail: 'Please provide a valid email address',
                    },
                    children: [],
                },
            ];

            // Since we're testing the controller's explicit validation,
            // we need to simulate what class-validator would return
            jest.spyOn(require('class-validator'), 'validate').mockResolvedValue(validationErrors);

            await expect(controller.login(mockRequest, invalidLoginDto as LoginDto))
                .rejects
                .toThrow(BadRequestException);
        });

        it('should throw BadRequestException for missing password', async () => {
            const invalidLoginDto = {
                email: 'test@example.com',
                password: '',
            };

            const validationErrors = [
                {
                    property: 'password',
                    constraints: {
                        isNotEmpty: 'Password is required',
                        minLength: 'Password must be at least 8 characters long',
                    },
                    children: [],
                },
            ];

            jest.spyOn(require('class-validator'), 'validate').mockResolvedValue(validationErrors);

            await expect(controller.login(mockRequest, invalidLoginDto as LoginDto))
                .rejects
                .toThrow(BadRequestException);
        });

        it('should throw BadRequestException for weak password', async () => {
            const invalidLoginDto = {
                email: 'test@example.com',
                password: 'weak',
            };

            const validationErrors = [
                {
                    property: 'password',
                    constraints: {
                        minLength: 'Password must be at least 8 characters long',
                        matches: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
                    },
                    children: [],
                },
            ];

            jest.spyOn(require('class-validator'), 'validate').mockResolvedValue(validationErrors);

            await expect(controller.login(mockRequest, invalidLoginDto as LoginDto))
                .rejects
                .toThrow(BadRequestException);
        });

        it('should handle authentication service errors', async () => {
            mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

            await expect(controller.login(mockRequest, validLoginDto))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should format validation errors correctly', async () => {
            const invalidLoginDto = {
                email: 'invalid',
                password: '123',
            };

            const validationErrors = [
                {
                    property: 'email',
                    constraints: {
                        isEmail: 'Please provide a valid email address',
                    },
                    children: [],
                },
                {
                    property: 'password',
                    constraints: {
                        minLength: 'Password must be at least 8 characters long',
                        matches: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
                    },
                    children: [],
                },
            ];

            jest.spyOn(require('class-validator'), 'validate').mockResolvedValue(validationErrors);

            try {
                await controller.login(mockRequest, invalidLoginDto as LoginDto);
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                const badRequestError = error as BadRequestException;
                expect(badRequestError.getResponse()).toMatchObject({
                    success: false,
                    message: 'Validation failed',
                    errors: {
                        email: ['Please provide a valid email address'],
                        password: [
                            'Password must be at least 8 characters long',
                            'Password must contain at least one lowercase letter, one uppercase letter, and one number',
                        ],
                    },
                });
            }
        });
    });
});

/**
 * Integration test examples for validation scenarios
 */
export const LoginValidationTestCases = {
    validCases: [
        {
            description: 'Valid email and strong password',
            input: {
                email: 'user@example.com',
                password: 'StrongPassword123!',
            },
            expected: 'success',
        },
        {
            description: 'Valid email with minimum password requirements',
            input: {
                email: 'test.user+label@domain.co.uk',
                password: 'Pass1234',
            },
            expected: 'success',
        },
    ],

    invalidCases: [
        {
            description: 'Empty email',
            input: {
                email: '',
                password: 'ValidPassword123!',
            },
            expectedError: 'Email is required',
        },
        {
            description: 'Invalid email format',
            input: {
                email: 'invalid-email',
                password: 'ValidPassword123!',
            },
            expectedError: 'Please provide a valid email address',
        },
        {
            description: 'Email too long',
            input: {
                email: 'a'.repeat(250) + '@example.com',
                password: 'ValidPassword123!',
            },
            expectedError: 'Email must not exceed 255 characters',
        },
        {
            description: 'Empty password',
            input: {
                email: 'user@example.com',
                password: '',
            },
            expectedError: 'Password is required',
        },
        {
            description: 'Password too short',
            input: {
                email: 'user@example.com',
                password: '1234567',
            },
            expectedError: 'Password must be at least 8 characters long',
        },
        {
            description: 'Password too long',
            input: {
                email: 'user@example.com',
                password: 'a'.repeat(130),
            },
            expectedError: 'Password must not exceed 128 characters',
        },
        {
            description: 'Password without uppercase',
            input: {
                email: 'user@example.com',
                password: 'weakpassword123',
            },
            expectedError: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        },
        {
            description: 'Password without lowercase',
            input: {
                email: 'user@example.com',
                password: 'WEAKPASSWORD123',
            },
            expectedError: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        },
        {
            description: 'Password without numbers',
            input: {
                email: 'user@example.com',
                password: 'WeakPassword',
            },
            expectedError: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        },
    ],
};
