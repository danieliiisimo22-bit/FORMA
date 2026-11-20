import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [input, output] = process.argv.slice(2)
const representations = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128],
  ['ic08', 256], ['ic09', 512], ['ic10', 1024],
]

function block(type, data) {
  const header = Buffer.alloc(8)
  header.write(type, 0, 'ascii')
  header.writeUInt32BE(data.length + header.length, 4)
  return Buffer.concat([header, data])
}

const sections = representations.map(([type, size]) => block(type, readFileSync(join(input, size + '.png'))))
writeFileSync(output, block('icns', Buffer.concat(sections)))
