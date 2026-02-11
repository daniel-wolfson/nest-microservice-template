import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/postgres';
var pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    await prisma.user.deleteMany();

    // eslint-disable-next-line no-console
    console.log('Seeding...');

    const plainPassword = '123456'; //Secret42
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    // Result: $2b$10$yjh4MYBO/eNJKxcpODqbt.dQ/0u80wV.bR5uFRv7n27bmHI0glw1G

    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    // eslint-disable-next-line no-console
    console.log('', isMatch);
    const data: Prisma.UserCreateInput = {
        email: 'maverick@topgun.com',
        name: 'Pete',
        password: hashedPassword,
    };

    await prisma.user.create({ data });

    // eslint-disable-next-line no-console
    console.log('Data loaded!');
}

// eslint-disable-next-line promise/catch-or-return
main()
    .catch(error => {
        // eslint-disable-next-line no-console
        console.error(error);
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .finally(async () => {
        await prisma.$disconnect();
    });
