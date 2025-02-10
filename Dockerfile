FROM node:18

WORKDIR /usr/src/app

RUN corepack enable

# Files required by pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# See https://github.com/nodejs/corepack/issues/612#issue-2812166605
ENV COREPACK_INTEGRITY_KEYS='{"npm":[{"expires":"2025-01-29T00:00:00.000Z","keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","keytype":"ecdsa-sha2-nistp256","scheme":"ecdsa-sha2-nistp256","key":"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="},{"expires":null,"keyid":"SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U","keytype":"ecdsa-sha2-nistp256","scheme":"ecdsa-sha2-nistp256","key":"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g=="}]}'
RUN pnpm fetch

# Bundle remaining app source
COPY . .

RUN pnpm install --frozen-lockfile -r --offline

RUN npm run build

CMD npm run start:bot
