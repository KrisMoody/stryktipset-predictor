export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('close', async () => {
    const { prisma } = await import('~/server/utils/prisma')
    await prisma.$disconnect()
  })
})
