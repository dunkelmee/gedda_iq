/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // enables optimised Docker image
};

module.exports = nextConfig;
