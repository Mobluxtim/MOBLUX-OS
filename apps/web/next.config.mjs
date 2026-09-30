export default {
  agentRules: false,
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() { return [{ source: '/api/:path*', destination: `http://127.0.0.1:${process.env.API_PORT || '3001'}/api/:path*` }]; },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'no-referrer' }] }]; }
};
