import { PrismaClient, FlagLevel, PlatformRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminId = process.env.SEED_ADMIN_DISCORD_ID ?? '123456789012345678';
  const trustedId = process.env.SEED_TRUSTED_DISCORD_ID ?? '987654321098765432';

  await prisma.platformAccount.upsert({
    where: { discordUserId: adminId },
    update: { role: PlatformRole.ADMIN },
    create: {
      discordUserId: adminId,
      role: PlatformRole.ADMIN,
    },
  });

  await prisma.trustedUser.upsert({
    where: { discordUserId: trustedId },
    update: { trustLevel: 3 },
    create: {
      discordUserId: trustedId,
      trustLevel: 3,
      grantedByDiscordId: adminId,
    },
  });

  await prisma.user.upsert({
    where: { discordId: adminId },
    update: {},
    create: {
      discordId: adminId,
      flagScore: 0,
      flagLevel: FlagLevel.CLEAN,
    },
  });

  await prisma.server.upsert({
    where: { guildId: '111111111111111111' },
    update: {},
    create: {
      guildId: '111111111111111111',
      config: {
        alertMinLevel: 'SUSPICIOUS',
      },
    },
  });

  console.log('Seed complete (platform admin, trusted user, sample server).');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
