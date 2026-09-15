/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 blocks cross-origin requests to /_next/* dev resources, allowing
  // only the host the dev server was started with (`localhost`). Under WSL2 the
  // browser on the Windows host reaches the server by its WSL NIC address, so
  // every dev chunk and the HMR socket get blocked: the page server-renders,
  // React never hydrates, and it sits on the loading spinner forever.
  // Development-only setting; it has no effect on `next build`/`next start`.
  allowedDevOrigins: ['127.0.0.1', '172.22.85.13', '172.*.*.*', '192.168.*.*'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'myhappyhour.co.ke',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
      {
        protocol: 'https',
        hostname: 'i.vimeocdn.com',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-XSS-Protection', value: '0' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://player.vimeo.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com https://myhappyhour.co.ke https://logo.clearbit.com https://i.vimeocdn.com https://f.vimeocdn.com https://*.tile.openstreetmap.org",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://api.paystack.co https://vimeo.com https://*.vimeo.com https://*.vimeocdn.com",
            "frame-src 'self' https://checkout.paystack.com https://player.vimeo.com https://vimeo.com",
          ].join('; '),
        },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    },
  ],
};

export default nextConfig;
