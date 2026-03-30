// api/mcp-debug.js — temporary debug endpoint
export default async function handler(req, res) {
  const bodyType = typeof req.body
  const bodyValue = req.body
  const bodyKeys = bodyType === 'object' && bodyValue !== null ? Object.keys(bodyValue) : []

  let streamData = ''
  try {
    streamData = await new Promise((resolve) => {
      let d = ''
      req.on('data', c => { d += c })
      req.on('end', () => resolve(d))
      req.on('error', () => resolve('stream-error'))
      setTimeout(() => resolve('timeout'), 3000)
    })
  } catch (e) {
    streamData = 'stream-exception: ' + e.message
  }

  return res.status(200).json({
    method: req.method,
    body_type: bodyType,
    body_value: bodyValue,
    body_keys: bodyKeys,
    stream_data: streamData,
    content_type: req.headers['content-type'],
  })
}
