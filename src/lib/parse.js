// Shared parsing utilities for commit-message articles

export function parseArticleCommit(message) {
  const lines = message.replace(/\r\n/g, '\n').split('\n');
  const title = lines.shift() || '';
  if (lines[0] === '') lines.shift(); // remove single blank
  let trailerStart = lines.length;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^[A-Za-z0-9_-]+:\s/.test(lines[i])) {
      trailerStart = i;
    } else {
      break;
    }
  }
  const bodyLines = lines.slice(0, trailerStart);
  const trailerLines = lines.slice(trailerStart);
  const body = bodyLines.join('\n').trimEnd() + '\n';
  const trailers = {};
  trailerLines.forEach((line) => {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) trailers[m[1].toLowerCase()] = m[2];
  });
  return { title, body, trailers };
}
