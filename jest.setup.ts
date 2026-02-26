import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables before tests run
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
