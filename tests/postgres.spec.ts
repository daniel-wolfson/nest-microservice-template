import { PrismaClient, Language } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Using 'any' to bypass Prisma 7.x TypeScript type generation issues in tests
// The generated types may not be recognized by Jest's ts-jest transformer

describe('Prisma Seed Script', () => {
    let prisma: PrismaClient;
    let pool: Pool;

    beforeAll(() => {
        const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/postgres';
        pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter } as any);
    });

    afterAll(async () => {
        if (prisma) {
            await prisma.$disconnect();
        }
        if (pool) {
            await pool.end();
        }
    });

    beforeEach(async () => {
        // Clean up before each test
        await prisma.user.deleteMany();
    });

    describe('User Seeding', () => {
        it('should create a user with hashed password', async () => {
            const plainPassword = '123456';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

            const user = await prisma.user.create({
                data: {
                    email: 'maverick@topgun.com',
                    name: 'Pete',
                    //language: Language.EN_US,
                    password: hashedPassword,
                },
            });

            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.email).toBe('maverick@topgun.com');
            expect(user.name).toBe('Pete');
            //expect(user.language).toBe(Language.EN_US);
            expect(user.password).not.toBe(plainPassword);
            expect(user.createdAt).toBeInstanceOf(Date);
            expect(user.updatedAt).toBeInstanceOf(Date);
        });

        it('should hash password correctly using bcrypt', async () => {
            const plainPassword = '123456';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

            const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
            expect(isMatch).toBe(true);

            const isWrongPassword = await bcrypt.compare('wrongpassword', hashedPassword);
            expect(isWrongPassword).toBe(false);
        });

        it('should verify password starts with bcrypt prefix', async () => {
            const plainPassword = '123456';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

            expect(hashedPassword).toMatch(/^\$2[aby]\$/);
            expect(hashedPassword.length).toBeGreaterThan(50);
        });

        it('should create user with all required fields', async () => {
            const hashedPassword = await bcrypt.hash('123456', 10);

            const user = await prisma.user.create({
                data: {
                    email: 'test@example.com',
                    name: 'Test User',
                    password: hashedPassword,
                },
            });

            expect(user.email).toBe('test@example.com');
            expect(user.name).toBe('Test User');
        });

        it('should throw error for duplicate email', async () => {
            const hashedPassword = await bcrypt.hash('123456', 10);

            await prisma.user.create({
                data: {
                    email: 'duplicate@example.com',
                    name: 'First User',
                    password: hashedPassword,
                },
            });

            await expect(
                prisma.user.create({
                    data: {
                        email: 'duplicate@example.com',
                        name: 'Second User',
                        password: hashedPassword,
                    },
                }),
            ).rejects.toThrow();
        });

        it('should generate UUID for user id', async () => {
            const hashedPassword = await bcrypt.hash('123456', 10);

            const user = await prisma.user.create({
                data: {
                    email: 'uuid-test@example.com',
                    name: 'UUID Test',
                    password: hashedPassword,
                },
            });

            expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        describe('Database Operations', () => {
            it('should delete all users before seeding', async () => {
                // Create some users
                const hashedPassword = await bcrypt.hash('123456', 10);

                await prisma.user.create({
                    data: {
                        email: 'user1@example.com',
                        name: 'User 1',
                        password: hashedPassword,
                    },
                });

                await prisma.user.create({
                    data: {
                        email: 'user2@example.com',
                        name: 'User 2',
                        password: hashedPassword,
                    },
                });

                // Verify users exist
                let count = await prisma.user.count();
                expect(count).toBe(2);

                // Delete all users (simulating seed script behavior)
                await prisma.user.deleteMany();

                // Verify all deleted
                count = await prisma.user.count();
                expect(count).toBe(0);
            });

            it('should find created user by email', async () => {
                const hashedPassword = await bcrypt.hash('123456', 10);

                await prisma.user.create({
                    data: {
                        email: 'findme@example.com',
                        name: 'Find Me',
                        password: hashedPassword,
                    },
                });

                const foundUser = await prisma.user.findUnique({
                    where: { email: 'findme@example.com' },
                });

                expect(foundUser).toBeDefined();
                expect(foundUser?.email).toBe('findme@example.com');
                expect(foundUser?.name).toBe('Find Me');
            });

            it('should auto-update updatedAt timestamp', async () => {
                const hashedPassword = await bcrypt.hash('123456', 10);

                const user = await prisma.user.create({
                    data: {
                        email: 'timestamp@example.com',
                        name: 'Timestamp Test',
                        password: hashedPassword,
                    },
                });

                const originalUpdatedAt = user.updatedAt;

                // Wait a bit and update
                await new Promise(resolve => setTimeout(resolve, 100));

                const updatedUser = await prisma.user.update({
                    where: { id: user.id },
                    data: { name: 'Updated Name' },
                });

                expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
            });
        });

        // describe('Language Enum', () => {
        //     it('should accept valid Language enum values', async () => {
        //         const hashedPassword = await bcrypt.hash('123456', 10);

        //         const userEN = await prisma.user.create({
        //             data: {
        //                 email: 'english@example.com',
        //                 name: 'English User',
        //                 password: hashedPassword,
        //             },
        //         });

        //         const userES = await prisma.user.create({
        //             data: {
        //                 email: 'spanish@example.com',
        //                 name: 'Spanish User',
        //                 password: hashedPassword,
        //             },
        //         });

        //         expect(userEN.language).toBe('EN_US');
        //         expect(userES.language).toBe('ES_ES');
        //     });

        //     it('should have both language options available', () => {
        //         expect(Language.EN_US).toBe('EN_US');
        //         expect(Language.ES_ES).toBe('ES_ES');
        //         expect(Object.keys(Language)).toHaveLength(2);
        //     });
        // });
    });

    describe('Full Seed Simulation', () => {
        it('should replicate the complete seed script flow', async () => {
            // Step 1: Delete all existing users
            await prisma.user.deleteMany();
            let count = await prisma.user.count();
            expect(count).toBe(0);

            // Step 2: Hash password
            const plainPassword = '123456';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

            // Step 3: Verify password hashing
            const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
            expect(isMatch).toBe(true);

            // Step 4: Create user
            const user = await prisma.user.create({
                data: {
                    email: 'maverick@topgun.com',
                    name: 'Pete',
                    password: hashedPassword,
                },
            });

            // Step 5: Verify user was created
            expect(user).toBeDefined();
            expect(user.email).toBe('maverick@topgun.com');
            expect(user.name).toBe('Pete');

            // Step 6: Verify we can find the user
            const foundUser = await prisma.user.findUnique({
                where: { email: 'maverick@topgun.com' },
            });

            expect(foundUser).toBeDefined();
            expect(foundUser?.id).toBe(user.id);

            // Step 7: Verify password can be compared
            const canLogin = await bcrypt.compare(plainPassword, foundUser!.password);
            expect(canLogin).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing required fields', async () => {
            await expect(
                prisma.user.create({
                    data: {
                        // Missing required fields
                        email: 'incomplete@example.com',
                    } as any,
                }),
            ).rejects.toThrow();
        });

        it('should handle invalid email format at database level', async () => {
            const hashedPassword = await bcrypt.hash('123456', 10);

            // Prisma/Postgres will accept any string for email
            // Validation should be done at application level
            const user = await prisma.user.create({
                data: {
                    email: 'not-validated-by-db', // Invalid format but accepted by DB
                    name: 'Test',
                    password: hashedPassword,
                },
            });

            expect(user).toBeDefined();
            // This shows that email validation should be done in your DTO/validators
        });
    });
});
