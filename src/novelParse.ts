export type Chapter = { title: string; paragraphs: string[]; done: number }

const headingPattern = /^(第[0-9零一二三四五六七八九十百千万两]+[章回节卷]|楔子|序章|序言|终章|尾声|番外|后记)[^\n]*$/

// 按"第X章"等标题把小说全文拆成章节；标题前的内容归入以书名命名的首章。
export function parseNovelText(text: string, fallbackTitle: string): Chapter[] {
  const chapters: Chapter[] = []
  let current: Chapter | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (headingPattern.test(line)) {
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
