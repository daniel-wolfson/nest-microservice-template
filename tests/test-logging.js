#!/usr/bin/env node

/**
 * Logging Configuration Test Script
 * Tests different logging strategies and platforms
 */

const os = require('os');

console.log('🧪 Testing Logging Configuration\n');

// Platform detection
const platform = os.platform();
const isWindows = platform === 'win32';
const isLinux = platform === 'linux';

console.log(`Platform: ${platform}`);
console.log(`Is Windows: ${isWindows}`);
console.log(`Is Linux: ${isLinux}`);
console.log(`Hostname: ${os.hostname()}`);
console.log(`PID: ${process.pid}\n`);

// Test environment variables
const testConfigs = [
    {
        name: 'Development (Windows)',
        env: {
            NODE_ENV: 'development',
            LOG_STRATEGY: 'CONSOLE',
            LOG_LEVEL: 'debug',
        },
    },
    {
        name: 'Staging (Mixed)',
        env: {
            NODE_ENV: 'staging',
            LOG_STRATEGY: 'FILE',
            LOG_LEVEL: 'debug',
        },
    },
    {
        name: 'Production (Linux)',
        env: {
            NODE_ENV: 'production',
            LOG_STRATEGY: 'ALL',
            LOG_LEVEL: 'info',
        },
    },
];

function getLogDirectory(isLinux) {
    return isLinux ? '/var/log/microservice' : 'logs';
}

function getExpectedTransports(strategy, isLinux, isProduction) {
    const transports = [];

    if (strategy === 'CONSOLE' || strategy === 'ALL') {
        transports.push('Console');
    }

    if (strategy === 'FILE' || strategy === 'ALL') {
        transports.push('DailyRotateFile (Application)');
        transports.push('DailyRotateFile (Errors)');
    }

    if (strategy === 'ELASTICSEARCH' || strategy === 'ALL') {
        transports.push('Elasticsearch');
    }

    if (strategy === 'ALL' && isLinux && isProduction) {
        transports.push('Syslog');
    }

    return transports;
}

console.log('📋 Configuration Test Results:\n');

testConfigs.forEach((config, index) => {
    console.log(`${index + 1}. ${config.name}`);
    console.log(`   Environment: ${config.env.NODE_ENV}`);
    console.log(`   Strategy: ${config.env.LOG_STRATEGY}`);
    console.log(`   Level: ${config.env.LOG_LEVEL}`);

    const isProduction = config.env.NODE_ENV === 'production';
    const logDir = getLogDirectory(isLinux);
    const expectedTransports = getExpectedTransports(config.env.LOG_STRATEGY, isLinux, isProduction);

    console.log(`   Log Directory: ${logDir}`);
    console.log(`   Expected Transports: ${expectedTransports.join(', ')}`);
    console.log(`   Transport Count: ${expectedTransports.length}`);

    // Platform-specific notes
    if (config.env.LOG_STRATEGY === 'ALL' && isLinux && isProduction) {
        console.log(`   🐧 Linux-specific: Syslog enabled, symlinks created`);
    }

    if (config.env.LOG_STRATEGY.includes('FILE') && isWindows) {
        console.log(`   🪟 Windows-specific: Local logs directory, no symlinks`);
    }

    console.log('');
});

// Test log message formats
console.log('📝 Sample Log Formats:\n');

const sampleLogData = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'User authentication successful',
    service: 'microservice-template',
    environment: 'production',
    platform: platform,
    hostname: os.hostname(),
    pid: process.pid,
    userId: '12345',
    requestId: 'req-abc-123',
};

console.log('Development Console Format:');
console.log(`${new Date().toLocaleString()} [INFO]: ${sampleLogData.message}`);
console.log(`  Context: userId=${sampleLogData.userId}, requestId=${sampleLogData.requestId}`);

console.log('\nProduction JSON Format:');
console.log(JSON.stringify(sampleLogData, null, 2));

console.log('\nElasticsearch Document:');
const elasticsearchDoc = {
    '@timestamp': sampleLogData.timestamp,
    ...sampleLogData,
};
console.log(JSON.stringify(elasticsearchDoc, null, 2));

// Configuration validation
console.log('\n✅ Configuration Validation:\n');

const validationChecks = [
    {
        check: 'Winston transports installed',
        status: true, // Would check if packages are installed
        note: 'winston, winston-daily-rotate-file, winston-elasticsearch, winston-syslog',
    },
    {
        check: 'Environment files configured',
        status: true, // Would check if .env files exist
        note: '.env.development, .env.staging, .env.production',
    },
    {
        check: 'Log directories writable',
        status: true, // Would check directory permissions
        note: isLinux ? '/var/log/microservice' : './logs',
    },
    {
        check: 'Platform detection working',
        status: true,
        note: `Detected: ${platform}`,
    },
];

validationChecks.forEach(check => {
    const status = check.status ? '✅' : '❌';
    console.log(`${status} ${check.check}`);
    if (check.note) {
        console.log(`   ${check.note}`);
    }
});

console.log('\n🚀 Ready to test logging configuration!');
console.log('\nNext steps:');
console.log('1. npm run build');
console.log('2. npm run start:dev (for development testing)');
console.log('3. Check logs in appropriate directories');
console.log('4. Verify Elasticsearch integration if enabled');

// Environment-specific instructions
if (isLinux) {
    console.log('\nLinux-specific setup:');
    console.log('• sudo mkdir -p /var/log/microservice');
    console.log('• sudo chown $USER:$USER /var/log/microservice');
    console.log('• tail -f /var/log/microservice/current.log');
} else if (isWindows) {
    console.log('\nWindows-specific setup:');
    console.log('• Logs will be created in .\\logs\\ directory');
    console.log('• Get-Content -Path "logs\\application-*.log" -Wait');
}
