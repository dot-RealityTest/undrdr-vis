import { resolveMx, resolveTxt } from 'node:dns/promises'

const domain = process.argv[2] || 'undrdr.com'

async function safeResolve(label, resolver) {
  try {
    return await resolver()
  } catch {
    return []
  }
}

const [mx, txt, dmarc] = await Promise.all([
  safeResolve('mx', () => resolveMx(domain)),
  safeResolve('txt', () => resolveTxt(domain)),
  safeResolve('dmarc', () => resolveTxt(`_dmarc.${domain}`)),
])

const spf = txt.flat().find((record) => record.startsWith('v=spf1')) || null
const dmarcRecord = dmarc.flat().find((record) => record.startsWith('v=DMARC1')) || null

console.log(`UND-RDR email DNS check: ${domain}`)
console.log(`- MX records: ${mx.length ? mx.map((record) => `${record.priority} ${record.exchange}`).join(', ') : 'missing'}`)
console.log(`- SPF record: ${spf || 'missing'}`)
console.log(`- DMARC record: ${dmarcRecord || 'missing'}`)

if (!mx.length || !spf || !dmarcRecord) {
  process.exitCode = 1
}
