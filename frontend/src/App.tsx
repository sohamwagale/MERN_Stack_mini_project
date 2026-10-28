import { useEffect, useState } from 'react'
import { courses, getAllLessons, getCourse, courseHoursFromModules, formatDuration } from './data/courses'
import type { Course, Module } from './data/courses'
import { downloadCertificate, getOrCreateCertificateId } from './lib/certificate'
import { getLearnerName, getProgress, resetProgress, setLearnerName, toggleLesson, saveProgress } from './lib/progress'
import { getStoredUser, fetchCurrentUser, clearAuth } from './lib/auth'
import type { AuthUser } from './lib/auth'
import AuthModal from './components/AuthModal'
import QuizView from './components/QuizView'
import CodingWorkbench from './components/CodingWorkbench'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/')

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return hash
}

function go(path: string) {
  window.location.hash = path
}

export default function App() {
  const hash = useHash()
  const route = parseRoute(hash)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    // Try fetching fresh user profile from backend
    fetchCurrentUser().then((u) => {
      if (u) {
        setUser(u)
        // If user has saved progress in Mongo, merge with local
        if (u.progress && u.progress.length > 0) {
          const local = getProgress('mern')
          const merged = Array.from(new Set([...local.completed, ...u.progress]))
          saveProgress('mern', { completed: merged })
        }
      }
    })
  }, [])

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    setIsAuthOpen(true)
  }

  const handleAuthSuccess = (authUser: AuthUser) => {
    setUser(authUser)
    if (authUser.progress && authUser.progress.length > 0) {
      const local = getProgress('mern')
      const merged = Array.from(new Set([...local.completed, ...authUser.progress]))
      saveProgress('mern', { completed: merged })
    }
  }

  const handleLogout = () => {
    clearAuth()
    setUser(null)
  }

  return (
    <div className="app">
      <Header
        user={user}
        onLogin={() => handleOpenAuth('login')}
        onRegister={() => handleOpenAuth('register')}
        onLogout={handleLogout}
      />

      {route.name === 'home' && <Home />}
      {route.name === 'course' && <CoursePage courseId={route.courseId} />}
      {route.name === 'learn' && (
        <LearnPage courseId={route.courseId} lessonId={route.lessonId} />
      )}
      {route.name === 'certificate' && <CertificatePage courseId={route.courseId} />}
      {route.name === 'notfound' && (
        <main className="page">
          <div className="empty-card">
            <h1>Page not found</h1>
            <button className="btn primary" onClick={() => go('/')}>
              Back to catalog
            </button>
          </div>
        </main>
      )}

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <footer className="site-footer">
        <span>ForgeLearn</span>
        <span>MERN Academy with Express Auth, MongoDB, Quizzes & Coding Challenges.</span>
      </footer>
    </div>
  )
}

function Header({
  user,
  onLogin,
  onRegister,
  onLogout,
}: {
  user: AuthUser | null
  onLogin: () => void
  onRegister: () => void
  onLogout: () => void
}) {
  return (
    <header className="site-header">
      <div className="header-left">
        <a className="brand" href="#/">
          <span className="brand-mark">FL</span>
          ForgeLearn
        </a>
      </div>
      <nav className="header-nav">
        <a href="#/">Catalog</a>
        <a href="#/course/mern">MERN Path</a>
      </nav>
      <div className="header-auth">
        {user ? (
          <div className="user-profile-badge">
            <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.name}</span>
            <button className="btn-sm ghost" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-btns">
            <button className="btn-sm ghost" onClick={onLogin}>
              Sign In
            </button>
            <button className="btn-sm primary" onClick={onRegister}>
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Development academy</p>
        <h1>Learn to ship full-stack products.</h1>
        <p className="lede">
          Browse the catalog, complete the MERN Stack path (54+ hours) with hands-on video lectures,
          interleaved MCQ quizzes, and LeetCode-style coding challenges with instant validation.
        </p>
      </section>
      <section className="catalog">
        <div className="section-head">
          <h2>Courses</h2>
          <p>MERN Path is open with auth and interactive challenges. The rest open later.</p>
        </div>
        <div className="course-grid">
          {courses.map((course) => (
            <article key={course.id} className={`course-card ${course.available ? 'live' : 'locked'}`}>
              <div className="card-top">
                <span className="pill" style={{ color: course.accent }}>
                  {course.category}
                </span>
                {course.available ? (
                  <span className="status live">Open</span>
                ) : (
                  <span className="status">Coming soon</span>
                )}
              </div>
              <h3>{course.title}</h3>
              <p className="tagline">{course.tagline}</p>
              <p className="card-copy">{course.description}</p>
              <ul className="meta">
                <li>{courseHoursLabel(course)} hrs</li>
                <li>{course.level}</li>
                <li>★ {course.rating}</li>
              </ul>
              {course.available ? (
                <button className="btn primary" onClick={() => go(`/course/${course.id}`)}>
                  Continue course
                </button>
              ) : (
                <button className="btn ghost" onClick={() => go(`/course/${course.id}`)}>
                  View details
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function CoursePage({ courseId }: { courseId: string }) {
  const course = getCourse(courseId)
  const [, bump] = useState(0)

  if (!course) {
    return (
      <main className="page">
        <div className="empty-card">
          <h1>Course not found</h1>
          <button className="btn primary" onClick={() => go('/')}>
            Catalog
          </button>
        </div>
      </main>
    )
  }

  const lessons = getAllLessons(course)
  const progress = getProgress(course.id)
  const done = progress.completed.filter((id) => lessons.some((lesson) => lesson.id === id)).length
  const percent = lessons.length ? Math.round((done / lessons.length) * 100) : 0
  const complete = lessons.length > 0 && done === lessons.length
  const nextLesson = lessons.find((lesson) => !progress.completed.includes(lesson.id)) ?? lessons[0]

  if (!course.available) {
    return (
      <main className="page">
        <div className="empty-card">
          <p className="eyebrow">Locked</p>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <p className="muted">Only the MERN Stack Developer Path is open for completion right now.</p>
          <div className="row">
            <button className="btn primary" onClick={() => go('/course/mern')}>
              Open MERN path
            </button>
            <button className="btn ghost" onClick={() => go('/')}>
              Back to catalog
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page course-overview">
      <p className="eyebrow">{course.tagline}</p>
      <h1>{course.title}</h1>
      <p className="lede">{course.description}</p>
      <ul className="meta large">
        <li>{courseHoursFromModules(course)} hours</li>
        <li>{course.modules.length} modules</li>
        <li>{lessons.length} total units (Lectures, Quizzes & Code Challenges)</li>
        <li>{course.level}</li>
      </ul>
      <div className="progress-wrap">
        <div className="progress-label">
          <span>Overall Path Progress</span>
          <span>
            {done}/{lessons.length} units completed · {percent}%
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="row">
        {nextLesson && (
          <button className="btn primary" onClick={() => go(`/course/${course.id}/learn/${nextLesson.id}`)}>
            {done === 0 ? 'Start course' : complete ? 'Review course units' : 'Continue learning'}
          </button>
        )}
        {complete && (
          <button className="btn gold" onClick={() => go(`/course/${course.id}/certificate`)}>
            Get certificate
          </button>
        )}
        {done > 0 && (
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm('Reset all lesson progress for this course?')) {
                resetProgress(course.id)
                bump((n) => n + 1)
              }
            }}
          >
            Reset progress
          </button>
        )}
      </div>
      <div className="module-list">
        {course.modules.map((module, index) => (
          <ModuleBlock
            key={module.id}
            course={course}
            module={module}
            index={index}
            completed={progress.completed}
          />
        ))}
      </div>
    </main>
  )
}

function getLessonBadge(type?: string) {
  if (type === 'quiz') return { label: 'MCQ Quiz', icon: '📝', className: 'badge-quiz' }
  if (type === 'challenge') return { label: 'LeetCode Problem', icon: '💻', className: 'badge-challenge' }
  return { label: 'Lecture', icon: '🎬', className: 'badge-video' }
}

function ModuleBlock({
  course,
  module,
  index,
  completed,
}: {
  course: Course
  module: Module
  index: number
  completed: string[]
}) {
  const minutes = module.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)
  const done = module.lessons.filter((lesson) => completed.includes(lesson.id)).length

  return (
    <section className="module">
      <header>
        <div>
          <p className="eyebrow">Module {index + 1}</p>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <p className="module-meta">
          {formatDuration(minutes)} · {done}/{module.lessons.length} completed
        </p>
      </header>
      <ol>
        {module.lessons.map((lesson) => {
          const isDone = completed.includes(lesson.id)
          const badge = getLessonBadge(lesson.type)
          return (
            <li key={lesson.id}>
              <button
                className={`lesson-row ${isDone ? 'done' : ''}`}
                onClick={() => go(`/course/${course.id}/learn/${lesson.id}`)}
              >
                <span className="check">{isDone ? '✓' : ''}</span>
                <span className="lesson-copy">
                  <div className="lesson-title-line">
                    <span className={`type-tag ${badge.className}`}>{badge.icon} {badge.label}</span>
                    <strong>{lesson.title}</strong>
                  </div>
                  <em>{lesson.summary}</em>
                </span>
                <span className="mins">{formatDuration(lesson.durationMinutes)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function LearnPage({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const course = getCourse(courseId)
  const [, bump] = useState(0)

  useEffect(() => {
    if (!course?.available) go(`/course/${courseId}`)
  }, [course, courseId])

  if (!course || !course.available) return null

  const lessons = getAllLessons(course)
  const index = lessons.findIndex((lesson) => lesson.id === lessonId)
  const lesson = lessons[index]

  if (!lesson) {
    return (
      <main className="page">
        <div className="empty-card">
          <h1>Lesson not found</h1>
          <button className="btn primary" onClick={() => go(`/course/${course.id}`)}>
            Course outline
          </button>
        </div>
      </main>
    )
  }

  const progress = getProgress(course.id)
  const isDone = progress.completed.includes(lesson.id)
  const doneCount = progress.completed.filter((id) => lessons.some((item) => item.id === id)).length
  const complete = doneCount === lessons.length
  const prev = lessons[index - 1]
  const next = lessons[index + 1]
  const module = course.modules.find((item) => item.lessons.some((itemLesson) => itemLesson.id === lesson.id))

  function mark(done: boolean) {
    if (!course) return
    const updated = toggleLesson(course.id, lesson.id, done)
    const finished = lessons.every((item) => updated.completed.includes(item.id))
    bump((n) => n + 1)
    if (done && next) go(`/course/${course.id}/learn/${next.id}`)
    else if (done && finished) go(`/course/${course.id}/certificate`)
  }

  const badge = getLessonBadge(lesson.type)

  return (
    <div className="learn-layout">
      <aside className="learn-sidebar">
        <a className="back-link" href={`#/course/${course.id}`}>
          ← Back to course outline
        </a>
        {course.modules.map((item) => (
          <div key={item.id} className="side-module">
            <p>{item.title}</p>
            {item.lessons.map((itemLesson) => {
              const itemBadge = getLessonBadge(itemLesson.type)
              return (
                <a
                  key={itemLesson.id}
                  href={`#/course/${course.id}/learn/${itemLesson.id}`}
                  className={[
                    itemLesson.id === lesson.id ? 'current' : '',
                    progress.completed.includes(itemLesson.id) ? 'done' : '',
                  ].join(' ')}
                >
                  <span className="side-icon">{itemBadge.icon}</span>
                  <span className="side-text">{itemLesson.title}</span>
                </a>
              )
            })}
          </div>
        ))}
      </aside>

      <main className="learn-main">
        <div className="learn-header-row">
          <div>
            <div className="learn-badges">
              <span className={`type-tag ${badge.className}`}>{badge.icon} {badge.label}</span>
              <span className="eyebrow module-sub">{module?.title}</span>
            </div>
            <h1>{lesson.title}</h1>
            <p className="lesson-desc">{lesson.summary}</p>
            <p className="muted">
              Unit {index + 1} of {lessons.length} · Est. {formatDuration(lesson.durationMinutes)}
            </p>
          </div>
        </div>

        {/* Dynamic content based on lesson type */}
        {lesson.type === 'quiz' ? (
          <QuizView
            quizId={lesson.id}
            isCompleted={isDone}
            onComplete={() => mark(true)}
          />
        ) : lesson.type === 'challenge' ? (
          <CodingWorkbench
            problemId={lesson.id}
            isCompleted={isDone}
            onComplete={() => mark(true)}
          />
        ) : (
          <div className="player">
            <iframe
              title={lesson.title}
              src={`https://www.youtube.com/embed/${lesson.youtubeId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Global Navigation and Mark Complete Bar */}
        <div className="learn-footer-nav row wrap">
          <button className={`btn ${isDone ? 'ghost' : 'primary'}`} onClick={() => mark(!isDone)}>
            {isDone ? 'Mark as incomplete' : next ? 'Complete & continue' : 'Complete course'}
          </button>
          {prev && (
            <button className="btn ghost" onClick={() => go(`/course/${course.id}/learn/${prev.id}`)}>
              ← Previous Unit
            </button>
          )}
          {next && (
            <button className="btn ghost" onClick={() => go(`/course/${course.id}/learn/${next.id}`)}>
              Next Unit →
            </button>
          )}
          {complete && (
            <button className="btn gold" onClick={() => go(`/course/${course.id}/certificate`)}>
              🎓 Get certificate
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function CertificatePage({ courseId }: { courseId: string }) {
  const course = getCourse(courseId)
  const [name, setName] = useState(getLearnerName())
  const [error, setError] = useState('')
  const [certId] = useState(() => getOrCreateCertificateId(courseId))

  useEffect(() => {
    if (!course?.available) go('/')
  }, [course])

  if (!course || !course.available) return null

  const lessons = getAllLessons(course)
  const progress = getProgress(course.id)
  const done = progress.completed.filter((id) => lessons.some((lesson) => lesson.id === id)).length
  const complete = lessons.length > 0 && done === lessons.length
  const hours = courseHoursFromModules(course)
  const date = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function issue() {
    if (!course) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter the name that should appear on the certificate.')
      return
    }
    setLearnerName(trimmed)
    setError('')
    downloadCertificate({
      name: trimmed,
      course: course.title,
      hours,
      date,
      certificateId: certId,
    })
  }

  if (!complete) {
    return (
      <main className="page">
        <div className="empty-card">
          <h1>Finish the course first</h1>
          <p>
            You have completed {done} of {lessons.length} units (videos, quizzes, and coding challenges).
            Mark every unit complete to unlock your PDF certificate.
          </p>
          <button className="btn primary" onClick={() => go(`/course/${course.id}`)}>
            Return to course
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="page certificate-page">
      <p className="eyebrow">You finished the path</p>
      <h1>Certificate of completion</h1>
      <p className="lede">
        Enter your full name. We will generate a PDF for {course.title} ({hours} hours).
      </p>
      <label className="field">
        Name on certificate
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="preview">
        <div className="preview-top-row">
          <p className="preview-kicker">ForgeLearn Academy</p>
          <p className="preview-uuid-badge">UUID: <span>{certId}</span></p>
        </div>
        <h2>Certificate of Completion</h2>
        <p>This is to certify that</p>
        <p className="preview-name">{name.trim() || 'Your name'}</p>
        <p>has successfully completed</p>
        <p className="preview-course">{course.title}</p>
        <p>
          {hours} hours · {date}
        </p>
        <p className="preview-cert-id">
          Certificate UUID: <span>{certId}</span>
        </p>
      </div>
      <div className="row">
        <button className="btn gold" onClick={issue}>
          Download PDF certificate
        </button>
        <button className="btn ghost" onClick={() => go(`/course/${course.id}`)}>
          Back to course
        </button>
      </div>
    </main>
  )
}

function courseHoursLabel(course: Course) {
  return course.available ? courseHoursFromModules(course) : course.hours
}

type Route =
  | { name: 'home' }
  | { name: 'course'; courseId: string }
  | { name: 'learn'; courseId: string; lessonId: string }
  | { name: 'certificate'; courseId: string }
  | { name: 'notfound' }

function parseRoute(hash: string): Route {
  const path = hash.replace(/^\/+/, '')
  if (!path) return { name: 'home' }
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'course' || !parts[1]) return { name: 'notfound' }
  const courseId = parts[1]
  if (parts.length === 2) return { name: 'course', courseId }
  if (parts[2] === 'learn' && parts[3]) return { name: 'learn', courseId, lessonId: parts[3] }
  if (parts[2] === 'certificate') return { name: 'certificate', courseId }
  return { name: 'notfound' }
}
