import type { Config } from 'jest';

const shared = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.jsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(jose|otpauth)/)'],
} satisfies Partial<Config>;

const config: Config = {
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

export default config;
