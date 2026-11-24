// 교사 모니터링 페이지: 관리자 UID로 로그인한 경우에만 접근 가능
import './styles.css'
import './teacher.css'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { auth, db } from './firebaseConfig.js'
import { isAdmin } from './adminConfig.js'
import { ARTWORKS, findArtwork } from './artworks.js'
import { REFLECTIONS } from './submit.js'

const $ = (id) => document.getElementById(id)

const el = {
  main: $('teacher-main'),
  error: $('dashboard-error'),
  teacherName: $('teacher-name'),
  teacherEmail: $('teacher-email'),
  logout: $('logout-button'),

  dateList: $('date-list'),
  dateEmpty: $('date-empty'),
  selectAllDates: $('select-all-dates'),
  clearDates: $('clear-dates'),

  artFilterList: $('art-filter-list'),
  selectAllArts: $('select-all-arts'),
  clearArts: $('clear-arts'),

  recordList: $('record-list'),
  recordEmpty: $('record-empty'),
  recordCount: $('record-count'),

  conversationMeta: $('conversation-meta'),
  conversationLog: $('conversation-log'),
  conversationEmpty: $('conversation-empty'),

  artworkEmpty: $('artwork-empty'),
  artworkDetail: $('artwork-detail'),
  detailImage: $('detail-image'),
  detailTitle: $('detail-title'),
  detailArtist: $('detail-artist'),
  detailReflection: $('detail-reflection'),
  statChat: $('stat-chat'),
  statWriting: $('stat-writing'),
}

const state = {
  records: [], // Firestore 문서 (제출 최신순)
  selectedDates: new Set(), // 'YYYY-MM-DD'
  selectedArtworks: new Set(ARTWORKS.map((a) => a.id)), // 처음에는 작품 전체 선택
  selectedId: null,
  firstLoad: true,
}

// ---------- 날짜·시간 표시 ----------
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${y}.${pad(m)}.${pad(d)} (${weekday})`
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDuration(sec) {
  if (typeof sec !== 'number' || Number.isNaN(sec)) return '-'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

// ---------- 데이터 불러오기 (실시간) ----------
function listenRecords() {
  const q = query(collection(db, REFLECTIONS), orderBy('submittedAt', 'desc'))
  onSnapshot(
    q,
    (snapshot) => {
      state.records = snapshot.docs.map((d) => {
        const data = d.data()
        // 방금 저장되어 서버 시간이 아직 없을 수 있음
        const submittedAt = data.submittedAt?.toDate?.() ?? new Date()
        return { id: d.id, ...data, submittedAt, dateKey: dateKey(submittedAt) }
      })

      // 처음 열었을 때는 가장 최근 날짜를 선택
      if (state.firstLoad && state.records.length > 0) {
        state.selectedDates.add(state.records[0].dateKey)
      }
      state.firstLoad = false

      // 삭제되어 없어진 날짜는 선택에서 빼기
      const existing = new Set(state.records.map((r) => r.dateKey))
      for (const key of state.selectedDates) if (!existing.has(key)) state.selectedDates.delete(key)

      renderAll()
    },
    (error) => {
      console.error(error)
      showError(
        error.code === 'permission-denied'
          ? '데이터를 읽을 권한이 없어요. Firestore 보안 규칙에 관리자 UID가 등록되어 있는지 확인해 주세요.'
          : '데이터를 불러오지 못했어요. 새로고침해 주세요.',
      )
    },
  )
}

function showError(message) {
  el.error.textContent = message
  el.error.hidden = false
}

function renderAll() {
  renderDates()
  renderArtFilter()
  renderRecords()
  renderDetail()
}

// 체크박스 한 줄 만들기 (날짜·작품 공통)
function checkboxItem(value, labelText, count, checked) {
  const item = document.createElement('li')
  const label = document.createElement('label')
  label.className = 'filter-option'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.value = value
  checkbox.checked = checked

  const text = document.createElement('span')
  text.className = 'filter-text'
  text.textContent = labelText

  const badge = document.createElement('span')
  badge.className = 'filter-count'
  badge.textContent = `${count}건`

  label.append(checkbox, text, badge)
  item.append(label)
  return item
}

// ---------- 왼쪽: 날짜 체크박스 ----------
function renderDates() {
  const counts = new Map()
  for (const r of state.records) counts.set(r.dateKey, (counts.get(r.dateKey) || 0) + 1)

  el.dateList.replaceChildren(
    ...[...counts].map(([key, count]) =>
      checkboxItem(key, formatDateLabel(key), count, state.selectedDates.has(key)),
    ),
  )
  el.dateEmpty.hidden = counts.size > 0
}

el.dateList.addEventListener('change', (event) => {
  const checkbox = event.target
  if (checkbox.checked) state.selectedDates.add(checkbox.value)
  else state.selectedDates.delete(checkbox.value)
  renderArtFilter() // 작품별 건수는 선택한 날짜 기준
  renderRecords()
  renderDetail()
})

el.selectAllDates.addEventListener('click', () => {
  for (const r of state.records) state.selectedDates.add(r.dateKey)
  renderAll()
})

el.clearDates.addEventListener('click', () => {
  state.selectedDates.clear()
  renderAll()
})

// ---------- 왼쪽: 작품 체크박스 ----------
function renderArtFilter() {
  // 선택한 날짜 안에서 작품별 제출 수
  const counts = new Map()
  for (const r of state.records) {
    if (state.selectedDates.has(r.dateKey)) {
      counts.set(r.artwork?.id, (counts.get(r.artwork?.id) || 0) + 1)
    }
  }

  el.artFilterList.replaceChildren(
    ...ARTWORKS.map((artwork) =>
      checkboxItem(
        artwork.id,
        `${artwork.artist.split(' ').pop()} 「${artwork.title}」`,
        counts.get(artwork.id) || 0,
        state.selectedArtworks.has(artwork.id),
      ),
    ),
  )
}

el.artFilterList.addEventListener('change', (event) => {
  const checkbox = event.target
  if (checkbox.checked) state.selectedArtworks.add(checkbox.value)
  else state.selectedArtworks.delete(checkbox.value)
  renderRecords()
  renderDetail()
})

el.selectAllArts.addEventListener('click', () => {
  for (const a of ARTWORKS) state.selectedArtworks.add(a.id)
  renderAll()
})

el.clearArts.addEventListener('click', () => {
  state.selectedArtworks.clear()
  renderAll()
})

// ---------- 왼쪽: 제출 목록 ----------
function visibleRecords() {
  return state.records.filter(
    (r) => state.selectedDates.has(r.dateKey) && state.selectedArtworks.has(r.artwork?.id),
  )
}

function recordLabel(record) {
  const [, m, d] = record.dateKey.split('-')
  return {
    name: record.name || record.email || '이름 없음',
    when: `(${Number(m)}/${Number(d)}, ${formatTime(record.submittedAt)})`,
  }
}

function renderRecords() {
  const records = visibleRecords()
  if (!records.some((r) => r.id === state.selectedId)) state.selectedId = null

  el.recordList.replaceChildren()
  for (const record of records) {
    const { name, when } = recordLabel(record)

    const item = document.createElement('li')
    item.className = 'record-item'
    if (record.id === state.selectedId) item.classList.add('is-selected')

    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'record-open'
    open.dataset.id = record.id

    const nameEl = document.createElement('span')
    nameEl.className = 'record-name'
    nameEl.textContent = name

    const whenEl = document.createElement('span')
    whenEl.className = 'record-when'
    whenEl.textContent = when

    const artEl = document.createElement('span')
    artEl.className = 'record-art'
    artEl.textContent = record.artwork?.title ? `「${record.artwork.title}」` : ''

    open.append(nameEl, whenEl, artEl)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'record-delete'
    remove.dataset.id = record.id
    remove.setAttribute('aria-label', `${name} ${when} 데이터 삭제`)
    remove.textContent = '삭제'

    item.append(open, remove)
    el.recordList.append(item)
  }

  el.recordCount.textContent = `${records.length}건`
  el.recordEmpty.hidden = records.length > 0
  el.recordEmpty.textContent =
    state.selectedDates.size === 0
      ? '날짜를 선택하면 학생 목록이 나타나요.'
      : state.selectedArtworks.size === 0
        ? '작품을 하나 이상 선택해 주세요.'
        : '선택한 조건에 맞는 제출이 없어요.'
}

el.recordList.addEventListener('click', async (event) => {
  const openButton = event.target.closest('.record-open')
  if (openButton) {
    state.selectedId = openButton.dataset.id
    renderRecords()
    renderDetail()
    return
  }

  const deleteButton = event.target.closest('.record-delete')
  if (!deleteButton) return

  const record = state.records.find((r) => r.id === deleteButton.dataset.id)
  if (!record) return
  const { name, when } = recordLabel(record)
  if (!confirm(`정말 삭제할까요?\n\n${name} ${when}\n삭제하면 되돌릴 수 없어요.`)) return

  deleteButton.disabled = true
  try {
    await deleteDoc(doc(db, REFLECTIONS, record.id))
    // 목록은 onSnapshot이 자동으로 갱신
  } catch (error) {
    console.error(error)
    deleteButton.disabled = false
    alert(
      error.code === 'permission-denied'
        ? '삭제할 권한이 없어요. Firestore 보안 규칙을 확인해 주세요.'
        : '삭제하지 못했어요. 다시 시도해 주세요.',
    )
  }
})

// ---------- 가운데 + 오른쪽: 선택한 데이터 ----------
function renderDetail() {
  const record = state.records.find((r) => r.id === state.selectedId)

  el.conversationEmpty.hidden = Boolean(record)
  el.artworkEmpty.hidden = Boolean(record)
  el.artworkDetail.hidden = !record
  el.conversationLog.replaceChildren()
  el.conversationMeta.textContent = ''
  if (!record) return

  // 가운데: 대화 내용
  el.conversationMeta.textContent = `${record.name || '이름 없음'} · ${record.email || ''}`
  for (const message of record.messages || []) {
    const isStudent = message.role === 'user'
    const bubble = document.createElement('li')
    bubble.className = `talk ${isStudent ? 'talk-student' : 'talk-bot'}`

    const who = document.createElement('span')
    who.className = 'talk-who'
    who.textContent = isStudent ? record.name || '학생' : '감상 도우미'

    const text = document.createElement('p')
    text.className = 'talk-text'
    text.textContent = message.content

    bubble.append(who, text)
    el.conversationLog.append(bubble)
  }
  el.conversationLog.scrollTop = 0

  // 오른쪽: 고른 작품, 감상 문장, 시간
  const artwork = findArtwork(record.artwork?.id) || record.artwork || {}
  el.detailImage.src = artwork.image || ''
  el.detailImage.alt = `${artwork.artist || ''}, 「${artwork.title || ''}」`
  el.detailTitle.textContent = artwork.title ? `「${artwork.title}」` : '작품 정보 없음'
  el.detailArtist.textContent = [artwork.artist, artwork.year].filter(Boolean).join(', ')
  el.detailReflection.textContent = record.reflection || ''
  el.statChat.textContent = formatDuration(record.chatDurationSec)
  el.statWriting.textContent = formatDuration(record.writingDurationSec)
}

// ---------- 시작: 관리자 확인 ----------
let started = false

onAuthStateChanged(auth, (user) => {
  // 로그인하지 않았거나 관리자가 아니면 메인으로 돌려보내기
  if (!isAdmin(user)) {
    location.replace('./index.html')
    return
  }
  el.teacherName.textContent = user.displayName || '이름 없음'
  el.teacherEmail.textContent = user.email || ''
  el.main.hidden = false

  if (!started) {
    started = true
    listenRecords()
  }
})

el.logout.addEventListener('click', () => signOut(auth))
