import type { HealthCheckResponse } from '@grovio/contracts';
import { motion } from 'motion/react';

// TypeScript assertion that the HealthCheckResponse contract shape is usable
const _check: HealthCheckResponse = {
  status: 'ok',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
};

export default function App() {
  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-3 w-3 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-green-700">Running</span>
        </div>
        <h1 className="mb-2 rounded-md bg-grovio-primary px-3 py-1 text-3xl font-bold tracking-tight text-white">
          Grovio Vendor Panel
        </h1>
        <p className="mb-6 text-gray-500">Vendor dashboard and management panel</p>
        <div className="rounded-lg bg-gray-100 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Environment
          </p>
          <p className="font-mono text-sm text-gray-700">
            {import.meta.env['MODE'] ?? 'development'}
          </p>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Health contract: {_check.status} · v{_check.version}
        </p>
      </div>
    </motion.div>
  );
}
