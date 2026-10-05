export type Chapter = { title: string; paragraphs: string[]; done: number }

// 中文 txt 常见 GBK 编码：先按 UTF-8 严格解码，失败退回 GB18030（兼容 GBK）。
// BOM 由 TextDecoder 按规范自动剥掉，无需额外处理。
export function decodeNovelBytes(buffer: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
  catch { return new TextDecoder('gb18030').decode(buffer) }
}

// "第X章"可带任意标题文字；楔子/尾声等短词后只允许空白或标点，
// 否则正文行"楔子正文。"会被误判成标题，整行丢失。
// 〇/○ 是古书回目里常见的零字写法（如"第一二○回"），必须算作数字。
// 回目后要求分隔符或行尾，避免正文里"第四回中既将…"这类注解行被误判成标题。
const chapterHeading = /^第[0-9零一二三四五六七八九十百千万两〇○]+[章回节卷](?:$|[\s：:、·　])[^\n]*$/
const specialHeading = /^(楔子|序章|序言|终章|尾声|番外|后记)(?:$|[\s：:、])[^\n]*$/

// 按"第X章"等标题把小说全文拆成章节；标题前的内容归入以书名命名的首章。
export function parseNovelText(text: string, fallbackTitle: string): Chapter[] {
  const chapters: Chapter[] = []
  let current: Chapter | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (chapterHeading.test(line) || specialHeading.test(line)) {
      current = { title: line, paragraphs: [], done: 0 }
      chapters.push(current)
    } else {
      if (!current) {
        current = { title: fallbackTitle, paragraphs: [], done: 0 }
        chapters.push(current)
      }
      current.paragraphs.push(line)
    }
  }
  return chapters.filter((chapter) => chapter.paragraphs.length > 0)
}
