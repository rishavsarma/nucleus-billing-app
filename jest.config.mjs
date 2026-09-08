import nextJest from "next/jest.js"

// next/jest wires up SWC transforms + reads next.config.ts automatically,
// so TypeScript/JSX/path-alias resolution matches the real build exactly
// instead of hand-rolling a second, drift-prone transform config.
const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
const customJestConfig = {
  // These tests exercise route handlers, Redis-backed helpers, and other
  // server-only modules (import "server-only") — the Node environment
  // matches how they actually run; jsdom is only needed for tests that
  // render React components, none of which exist yet in this suite.
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  clearMocks: true,
}

export default createJestConfig(customJestConfig)
