// Plain JS on purpose: loading a jest.config.ts requires ts-node, which CI
// (Node 20, no ts-node) does not have.

/** @type {Partial<import('jest').Config>} */
const shared = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.jsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(jose|otpauth)/)'],
};

/** @type {import('jest').Config} */
const config = {
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/src/generated/'],
  projects: [
    {
      ...shared,
      displayName: 'node',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/unit/lib', '<rootDir>/tests/unit/api'],
    },
    {
      ...shared,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/tests/unit/components'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};

module.exports = config;
