import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const siteUrl = process.env.VITE_SITE_URL || 'https://akakika.com/undrdr/'
const imageUrl = process.env.VITE_SITE_IMAGE_URL || 'https://akakika.com/undrdr/assets/undrdr-discovery-icon-bright.png'

const checks = [
  ['canonical URL', `href="${siteUrl}"`],
  ['Open Graph URL', `property="og:url" content="${siteUrl}"`],
  ['Open Graph image', `property="og:image" content="${imageUrl}"`],
  ['Twitter image', `name="twitter:image" content="${imageUrl}"`],
  ['no Vite placeholders', 'VITE_SITE', true],
]

const failures = checks.filter(([, needle, shouldBeAbsent]) => {
  const found = html.includes(needle)
  return shouldBeAbsent ? found : !found
})

if (failures.length) {
  console.error('UND-RDR domain build verification failed:')
  failures.forEach(([label]) => console.error(`- ${label}`))
  process.exit(1)
}

console.log('UND-RDR domain build verification passed')
console.log(`- site URL: ${siteUrl}`)
console.log(`- image URL: ${imageUrl}`)
