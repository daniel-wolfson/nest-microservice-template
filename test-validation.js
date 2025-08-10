#!/usr/bin/env node

/**
 * Test script for login validation
 * Run with: node test-validation.js
 */

const { LoginDto } = require('./dist/src/modules/auth/dto/login.dto.js');
const { validate } = require('class-validator');
const { plainToClass } = require('class-transformer');

// Test cases
const testCases = [
    {
        name: 'Valid login',
        data: {
            email: 'user@example.com',
            password: 'ValidPassword123!'
        },
        expectValid: true
    },
    {
        name: 'Invalid email',
        data: {
            email: 'invalid-email',
            password: 'ValidPassword123!'
        },
        expectValid: false
    },
    {
        name: 'Weak password',
        data: {
            email: 'user@example.com',
            password: 'weak'
        },
        expectValid: false
    },
    {
        name: 'Empty fields',
        data: {
            email: '',
            password: ''
        },
        expectValid: false
    },
    {
        name: 'Password without uppercase',
        data: {
            email: 'user@example.com',
            password: 'weakpassword123'
        },
        expectValid: false
    }
];

async function runValidationTests() {
    console.log('🧪 Running Login DTO Validation Tests\n');
    
    for (const testCase of testCases) {
        console.log(`Testing: ${testCase.name}`);
        console.log(`Data: ${JSON.stringify(testCase.data)}`);
        
        try {
            // Transform plain object to DTO class instance
            const dto = plainToClass(LoginDto, testCase.data);
            
            // Validate the DTO
            const validationErrors = await validate(dto);
            
            const isValid = validationErrors.length === 0;
            const status = isValid ? '✅' : '❌';
            const expected = testCase.expectValid ? '✅' : '❌';
            
            console.log(`Result: ${status} (Expected: ${expected})`);
            
            if (!isValid) {
                const formattedErrors = validationErrors.reduce((acc, error) => {
                    acc[error.property] = Object.values(error.constraints || {});
                    return acc;
                }, {});
                console.log(`Errors: ${JSON.stringify(formattedErrors, null, 2)}`);
            }
            
            if (isValid === testCase.expectValid) {
                console.log('✓ Test passed');
            } else {
                console.log('✗ Test failed');
            }
            
        } catch (error) {
            console.log(`❌ Error running test: ${error.message}`);
        }
        
        console.log('-'.repeat(50));
    }
}

// Run tests if compiled code exists
try {
    runValidationTests().catch(console.error);
} catch (error) {
    console.log('⚠️  Please compile the project first with: npm run build');
    console.log('Then run this script: node test-validation.js');
}
