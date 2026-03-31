const requiredMajorVersion = 18
const currentVersion = process.versions.node
const currentMajorVersion = Number.parseInt(
  currentVersion.split('.')[0] ?? '0',
  10,
)

if (currentMajorVersion < requiredMajorVersion) {
  console.error(
    `[flashmini] Node.js >= ${requiredMajorVersion} is required. Current version: ${currentVersion}.`,
  )
  process.exit(1)
}
