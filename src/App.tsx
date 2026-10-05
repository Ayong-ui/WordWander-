import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, ChevronDown, ChevronRight, Clock3, FileText, FolderOpen,
  Keyboard, MoreHorizontal, Pause, Play, RotateCcw, Search, Settings2,
  SkipForward, Sun, Target, Upload, Volume2, WandSparkles, Moon,
} from 'lucide-react'
import './App.css'
import { decodeNovelBytes, parseNovelText, type Chapter } from './novelParse'

type FontChoice = { label: string; value: string }

const fonts: FontChoice[] = [
  { label: '霞鹜文楷', value: '"LXGW WenKai", "STKaiti", KaiTi, serif' },
  { label: '思源宋体', value: '"Noto Serif SC", "Songti SC", SimSun, serif' },
  { label: '系统黑体', value: 'system-ui, -apple-system, sans-serif' },
  { label: '等宽打字体', value: 'ui-monospace, "SFMono-Regular", Consolas, monospace' },
]

const initialChapters: Chapter[] = [
  {
    title: '第一章  雨中的车站', done: 3,
    paragraphs: [
      '雨水沿着站台的屋檐落下来，在昏黄的灯光里连成一串透明的珠帘。',
      '林深站在候车室门口，手里攥着一张已经被雨水打湿的车票。',
      '远处传来火车进站的声音，像一声从雾里传来的长叹。',
    ],
  },
  { title: '第二章  漫长的夏日', done: 0, paragraphs: ['夏天的风从老槐树的枝叶间穿过，带来一阵淡淡的青草香。', '他们在午后的河岸边坐了很久，谁也没有先开口说话。'] },
  { title: '第三章  写给远方的信', done: 0, paragraphs: ['信的最后只有一句话：无论你走到哪里，都要记得抬头看看月亮。'] },
  { title: '尾声  月亮升起时', done: 0, paragraphs: ['后来，所有的故事都在某个安静的夜晚重新有了回声。'] },
]

type Book = { title: string; chapters: Chapter[] }
const initialBooks: Book[] = [{ title: '雨季之后', chapters: initialChapters }]
// 内置的两本古腾堡公版书，启动时拉取并解析。
const builtInTitles = ['红楼梦', '三国演义']

function AppleToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`apple-toggle ${checked ? 'checked' : ''}`} onClick={onChange} aria-label={label} role="switch" aria-checked={checked}><span /></button>
}

function App() {
  const [books, setBooks] = useState(initialBooks)
  const [bookIndex, setBookIndex] = useState(0)
  const chapters = books[bookIndex].chapters
  const [chapterIndex, setChapterIndex] = useState(0)
  const [paragraphIndex, setParagraphIndex] = useState(0)
  // 已经确认提交的文字，只包含汉字或其他已经完成输入法组合的内容。
  // 逐字校验、错误统计、准确率统计都只依赖这个状态。
  const [committedInput, setCommittedInput] = useState(() => localStorage.getItem('wordwander-input') ?? '')
  // 中文输入法正在组合的临时内容，例如正在输入的 pin yin。
  // 这部分内容不能提前参与正确/错误判断。
  const [compositionText, setCompositionText] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [font, setFont] = useState(fonts[0].value)
  const [fontSize, setFontSize] = useState(24)
  const [seconds, setSeconds] = useState(12 * 60 + 48)
  const [errors, setErrors] = useState(8)
  const [totalTyped, setTotalTyped] = useState(3248)
  const inputRef = useRef<HTMLInputElement>(null)
  // ref 不会触发重新渲染，适合记录输入法当前是否处于组合状态。
  const isComposingRef = useRef(false)
  // 已确认文字的镜像，原生事件监听从这里读取，避免闭包里的旧值。
  const committedRef = useRef(committedInput)
  const fileRef = useRef<HTMLInputElement>(null)

  const paragraph = chapters[chapterIndex].paragraphs[paragraphIndex] ?? ''
  // 导入新书可能只换内容不换三个 index，原生监听器闭包会拿到旧段落，所以走 ref。
  const paragraphRef = useRef(paragraph)
  paragraphRef.current = paragraph
  const correctCount = useMemo(() => [...committedInput].filter((char, index) => char === paragraph[index]).length, [committedInput, paragraph])
  const accuracy = committedInput.length ? Math.round((correctCount / committedInput.length) * 100) : 100
  const wpm = Math.max(1, Math.round((correctCount / 5) / Math.max(seconds / 60, 0.2)))
  const chapterProgress = Math.round(((chapters[chapterIndex].done + (committedInput.length ? 0.6 : 0)) / chapters[chapterIndex].paragraphs.length) * 100)

  useEffect(() => {
    if (isPaused) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isPaused])

  useEffect(() => {
    localStorage.setItem('wordwander-input', committedInput)
    localStorage.setItem('wordwander-progress', JSON.stringify({ chapterIndex, paragraphIndex, totalTyped, errors }))
  }, [committedInput, chapterIndex, paragraphIndex, totalTyped, errors])

  useEffect(() => { inputRef.current?.focus() }, [chapterIndex, paragraphIndex, bookIndex])

  // StrictMode 下会执行两次，setBooks 内按书名去重。
  useEffect(() => {
    Promise.all(builtInTitles.map(async (title) => {
      const response = await fetch(`/books/${title}.txt`)
      if (!response.ok) return null
      const chapters = parseNovelText(decodeNovelBytes(await response.arrayBuffer()), title)
      return chapters.length ? { title, chapters } : null
    })).then((loaded) => {
      setBooks((items) => [...items, ...loaded.filter((book): book is Book => book !== null && !items.some((item) => item.title === book.title))])
    })
  }, [])


  // 只在重新开始、跳过段落、切换章节时调用。
  // 这里需要同时清理 React 状态和真实 input DOM 的 value。
  const clearInput = () => {
    committedRef.current = ''
    setCommittedInput('')
    setCompositionText('')
    const inputEl = inputRef.current
    if (inputEl) {
      inputEl.value = ' '
      inputEl.setSelectionRange(1, 1)
    }
  }

  const updateChapters = (updater: (items: Chapter[]) => Chapter[]) =>
    setBooks((items) => items.map((book, index) => index === bookIndex ? { ...book, chapters: updater(book.chapters) } : book))

  const completeParagraph = () => {
    updateChapters((items) => items.map((chapter, index) => index === chapterIndex ? { ...chapter, done: Math.max(chapter.done, paragraphIndex + 1) } : chapter))
    if (paragraphIndex < chapters[chapterIndex].paragraphs.length - 1) {
      setParagraphIndex((value) => value + 1)
      clearInput()
    }
  }
  const completeParagraphRef = useRef(completeParagraph)
  completeParagraphRef.current = completeParagraph

  const skipParagraph = () => {
    setParagraphIndex((value) => Math.min(value + 1, chapters[chapterIndex].paragraphs.length - 1))
    clearInput()
  }

  // 输入处理采用 Monkeytype 的成熟模式：输入框只是"事件传送带"，不是真相来源。
  // 提交时只信事件自带的 data（输入法自己报告的本次文字），从不读输入框的完整值；
  // 输入框值固定为"垫空格 + 已确认文字"，防止输入法把光标停在开头时新字插到旧字前面。
  useEffect(() => {
    const inputEl = inputRef.current
    if (!inputEl) return

    const syncInputElement = () => {
      const value = ' ' + committedRef.current
      inputEl.value = value
      inputEl.setSelectionRange(value.length, value.length)
    }

    const commitText = (data: string) => {
      const previousLength = committedRef.current.length
      const addedErrors = [...data].filter((char, index) => char !== paragraphRef.current[previousLength + index]).length
      if (addedErrors > 0) setErrors((current) => current + addedErrors)
      const newValue = committedRef.current + data
      committedRef.current = newValue
      setCommittedInput(newValue)
      setTotalTyped((current) => current + data.length)
      syncInputElement()
      if (newValue.length >= paragraphRef.current.length) completeParagraphRef.current()
    }

    const deleteChar = () => {
      const newValue = committedRef.current.slice(0, -1)
      committedRef.current = newValue
      setCommittedInput(newValue)
      syncInputElement()
    }

    const handleCompositionStart = () => {
      isComposingRef.current = true
      setCompositionText('')
    }
    const handleCompositionUpdate = (event: CompositionEvent) => {
      setCompositionText(event.data ?? '')
    }
    const handleCompositionEnd = (event: CompositionEvent) => {
      isComposingRef.current = false
      setCompositionText('')
      commitText(event.data ?? '')
    }
    const handleInput = (event: InputEvent) => {
      // 组合期间输入框的变化（拼音编辑）全部忽略，正式提交交给 compositionend。
      if (isComposingRef.current) return
      if (event.inputType === 'insertText') {
        // data 为空时（个别浏览器不填），从同步后的输入框值里取本次新增的部分。
        commitText(event.data ?? inputEl.value.slice(1 + committedRef.current.length))
      } else if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteWordBackward') {
        deleteChar()
      }
    }

    // 只放行打字和删除相关的变化，粘贴、拖拽等一律拦截，保证输入框值始终可控。
    const handleBeforeInput = (event: InputEvent) => {
      const allowed = ['insertText', 'insertCompositionText', 'insertFromComposition', 'deleteContentBackward', 'deleteWordBackward']
      if (!allowed.includes(event.inputType)) event.preventDefault()
    }

    inputEl.addEventListener('compositionstart', handleCompositionStart)
    inputEl.addEventListener('compositionupdate', handleCompositionUpdate)
    inputEl.addEventListener('compositionend', handleCompositionEnd)
    inputEl.addEventListener('input', handleInput)
    inputEl.addEventListener('beforeinput', handleBeforeInput)
    return () => {
      inputEl.removeEventListener('compositionstart', handleCompositionStart)
      inputEl.removeEventListener('compositionupdate', handleCompositionUpdate)
      inputEl.removeEventListener('compositionend', handleCompositionEnd)
      inputEl.removeEventListener('input', handleInput)
      inputEl.removeEventListener('beforeinput', handleBeforeInput)
    }
  }, [chapterIndex, paragraphIndex])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // Esc 只负责暂停/继续。
      if (event.key === 'Escape') { event.preventDefault(); setIsPaused((value) => !value) }
      // 输入法组合期间按 Enter 是选候选字，不能当作“下一段”。
      if (event.key === 'Enter' && document.activeElement === inputRef.current && !isComposingRef.current) {
        event.preventDefault()
        if (committedInput.length >= paragraph.length) completeParagraph(); else skipParagraph()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [committedInput, paragraph.length, bookIndex, chapterIndex, paragraphIndex])

  const selectChapter = (index: number) => { setChapterIndex(index); setParagraphIndex(0); clearInput() }
  const switchBook = (index: number) => { setBookIndex(index); setChapterIndex(0); setParagraphIndex(0); clearInput() }
  const resetParagraph = () => clearInput()
  const importNovel = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const title = file.name.replace(/\.txt$/i, '')
      const chapters = parseNovelText(decodeNovelBytes(reader.result as ArrayBuffer), title)
      if (!chapters.length) return
      const existing = books.findIndex((book) => book.title === title)
      const next = existing >= 0 ? books.map((book, index) => index === existing ? { title, chapters } : book) : [...books, { title, chapters }]
      setBooks(next)
      setBookIndex(existing >= 0 ? existing : books.length)
      setChapterIndex(0)
      setParagraphIndex(0)
      clearInput()
    }
    reader.readAsArrayBuffer(file)
  }
  const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

  return (
    <div className={`app-shell ${isDark ? 'dark' : ''}`} style={{ '--reading-font': font, '--reading-size': `${fontSize}px` } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><WandSparkles size={16} /></div><div><strong>WordWander</strong><span>墨色 · 字间漫游</span></div></div>
        <div className="sidebar-section library-head"><span>我的书库</span><button className="icon-button" onClick={() => fileRef.current?.click()} title="导入 TXT"><Upload size={16} /></button><input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(event) => importNovel(event.target.files?.[0])} /></div>
        <div className="search-box"><Search size={15} /><input placeholder="寻找一段文字" /></div>
        {books.map((book, index) => {
          const done = book.chapters.reduce((sum, chapter) => sum + chapter.done, 0)
          const total = book.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0)
          return <div key={book.title} className={`novel-card ${index === bookIndex ? 'active' : ''}`} onClick={() => switchBook(index)}><div className="novel-seal"><BookOpen size={21} /></div><div className="novel-meta"><strong>{book.title}</strong><span>{book.chapters.length} 章 · 正在练习</span><div className="mini-progress"><i style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} /></div></div><MoreHorizontal size={17} className="muted" /></div>
        })}
        <div className="sidebar-section chapter-label"><span>章节目录</span><span className="muted">{chapters.length} 章</span></div>
        <div className="chapter-list">{chapters.map((chapter, index) => <button key={`${index}-${chapter.title}`} className={`chapter-item ${index === chapterIndex ? 'selected' : ''}`} onClick={() => selectChapter(index)}><span className="chapter-chevron">{index === chapterIndex ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span className="chapter-name">{chapter.title}</span>{chapter.done > 0 && <span className="chapter-done">{Math.round((chapter.done / chapter.paragraphs.length) * 100)}%</span>}</button>)}</div>
        <div className="sidebar-bottom"><button className="utility-button"><FolderOpen size={16} />最近导入</button><button className="utility-button"><Settings2 size={16} />偏好设置</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>{books[bookIndex].title}</span><span className="slash">·</span><strong>{chapters[chapterIndex].title}</strong></div><div className="top-actions"><span className="autosave"><span className="status-dot" />墨迹已保存</span><div className="theme-switch"><Sun size={14} /><AppleToggle checked={isDark} onChange={() => setIsDark((value) => !value)} label="切换夜间模式" /><Moon size={13} /></div><button className="avatar">Y</button></div></header>
        <section className="workspace">
          <div className="practice-header"><div><div className="eyebrow"><span className="eyebrow-line" />字间练习</div><h1>{chapters[chapterIndex].title}</h1><p>第 {paragraphIndex + 1} 段 <span className="dot-separator">·</span> 每一次落笔，都让故事更近一点</p></div><div className="chapter-progress"><div className="progress-top"><span>章节进度</span><strong>{chapterProgress}%</strong></div><div className="progress-track"><i style={{ width: `${chapterProgress}%` }} /></div></div></div>
          <div className="reading-card">
            <div className="reading-toolbar"><span className="reading-label"><FileText size={15} />原文与输入</span><div className="toolbar-actions"><select className="font-select" value={font} onChange={(event) => setFont(event.target.value)}>{fonts.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}</select><button className="font-control" onClick={() => setFontSize((value) => Math.max(18, value - 1))}>A−</button><span className="font-size">{fontSize}</span><button className="font-control" onClick={() => setFontSize((value) => Math.min(32, value + 1))}>A+</button><span className="toolbar-divider" /><button className="icon-button subtle"><Volume2 size={16} /></button></div></div>
            <div className="comparison-area" onClick={() => inputRef.current?.focus()}>
              <div className="line-label">原文</div>
              <div className="source-line">{[...paragraph].map((char, index) => <span key={`${char}-${index}`} className={`${index < committedInput.length ? committedInput[index] === char ? 'correct' : 'wrong' : 'pending'} ${index === committedInput.length ? 'current' : ''}`}>{char}</span>)}</div>
              <div className="ink-divider"><span>你的输入</span><i /></div>
              <div className="line-label input-label">练习</div>
              <div className="typed-line">{[...committedInput].map((char, index) => <span key={`${char}-${index}`} className={char === paragraph[index] ? 'correct' : 'wrong'}>{char}</span>)}{compositionText && <span className="composition-text">{compositionText}</span>}<span className="typed-caret" />{committedInput.length === 0 && !compositionText && <span className="typed-placeholder">从这里开始，让文字流动起来…</span>}</div>
              <input ref={inputRef} className="typing-input" defaultValue={` ${committedInput}`} onFocus={(event) => { const position = event.currentTarget.value.length; event.currentTarget.setSelectionRange(position, position) }} disabled={isPaused} autoComplete="off" spellCheck={false} aria-label="打字输入框" />
            </div>
            <div className="typing-tip"><Keyboard size={15} />点击文字区域开始输入 <span>Enter 下一段</span><span>Esc 暂停</span></div>
          </div>
          <div className="practice-footer"><div className="footer-hint"><span className="keycap">Enter</span> 完成段落 <span className="footer-sep">·</span> <span className="keycap">Esc</span> 暂停</div><div className="footer-actions"><button className="secondary-button" onClick={resetParagraph}><RotateCcw size={15} />重新开始</button><button className="secondary-button" onClick={skipParagraph}>跳过段落<SkipForward size={15} /></button><button className="primary-button" onClick={() => setIsPaused((value) => !value)}>{isPaused ? <Play size={15} /> : <Pause size={15} />}{isPaused ? '继续练习' : '暂停练习'}</button></div></div>
        </section>
      </main>

      <aside className="stats-panel"><div className="stats-title"><span>今日墨迹</span><button className="icon-button subtle"><MoreHorizontal size={17} /></button></div><div className="focus-card"><div className="focus-icon"><Target size={17} /></div><div><strong>静心入字</strong><span>你已经连续练习 {Math.floor(seconds / 60)} 分钟</span></div></div><div className="metric-grid"><div className="metric-card featured"><span className="metric-label">当前速度</span><strong>{wpm}</strong><small>字 / 分钟</small><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div></div><div className="metric-card"><span className="metric-label">准确率</span><strong>{accuracy}<small>%</small></strong><div className="metric-ring" style={{ '--value': `${accuracy * 3.6}deg` } as React.CSSProperties}><span>{accuracy}%</span></div></div><div className="metric-card"><span className="metric-label">错误数</span><strong>{errors}</strong><small>本次练习</small><div className="metric-caption good">比上次少 12%</div></div><div className="metric-card"><span className="metric-label">练习时长</span><strong>{formatTime(seconds)}</strong><small>今日累计</small><Clock3 size={18} className="metric-icon" /></div></div><div className="session-section"><div className="section-heading"><span>本次练习</span><button className="muted-button">详情 <ChevronRight size={14} /></button></div><div className="session-row"><span>已输入字数</span><strong>{totalTyped.toLocaleString()}</strong></div><div className="session-row"><span>完成段落</span><strong>{chapters[chapterIndex].done} / {chapters[chapterIndex].paragraphs.length}</strong></div><div className="session-row"><span>最佳速度</span><strong>68 <em>字/分</em></strong></div></div><div className="quote-card"><div className="quote-mark">“</div><p>慢一点没关系，重要的是一直向前。</p><span>— WordWander</span></div></aside>
    </div>
  )
}

export default App
