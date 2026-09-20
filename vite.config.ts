import { defineConfig } from 'vitest/config';
export default defineConfig({ server: { host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:8787',ws:true}} },build:{target:'es2022'}, test:{include:['tests/**/*.test.ts']} });
