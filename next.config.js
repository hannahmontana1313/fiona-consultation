/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permettre le body parser désactivé pour le webhook Stripe
  api: {
    bodyParser: false,
  },
};

module.exports = nextConfig;
