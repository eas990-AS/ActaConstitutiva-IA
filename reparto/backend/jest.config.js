module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/env.js'],
  testTimeout: 30000,
};
