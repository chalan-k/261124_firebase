// 학생 활동 페이지: API Key 확인 → 작품 고르기 → 대화 → 한 문장 감상 제출
import './styles.css'
import './student.css'
import { ARTWORKS, findArtwork } from './artworks.js'
import { MIN_TURNS, MAX_TURNS, openingMessage } from './prompts.js'
import { verifyApiKey, getSavedApiKey, forgetApiKey, getReply, friendlyError } from './chatbot.js'
import { submitReflection, hasSubmitted } from './submit.js'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebaseConfig.js'

const $ = (id) => document.getElementById(id)

const el = {
  authLoading: $('auth-loading'),
  userName: $('user-name'),
  userEmail: $('user-email'),

  keySection: $('key-section'),
  keyForm: $('key-form'),
  keyInput: $('key-input'),
  keySubmit: $('key-submit'),
  keyMessage: $('key-message'),

  pickSection: $('pick-section'),
  artworkList: $('artwork-list'),

  chatSection: $('chat-section'),
  viewerImage: $('viewer-image'),
  viewerTitle: $('viewer-title'),
  viewerArtist: $('viewer-artist'),
  changeArtwork: $('change-artwork'),
  turnCounter: $('turn-counter'),
  chatLog: $('chat-log'),
  chatForm: $('chat-form'),
  chatInput: $('chat-input'),
  chatSend: $('chat-send'),
  chatActions: document.querySelector('.chat-actions'),
  chatHint: $('chat-hint'),
  chatEnd: $('chat-end'),

  reflectionForm: $('reflection-form'),
  reflectionInput: $('reflection-input'),
  reflectionCount: $('reflection-count'),
  reflectionSubmit: $('reflection-submit'),
  reflectionMessage: $('reflection-message'),
  doneBox: $('done-box'),
}

const state = {
  user: null, // 로그인한 Google 사용자
  artwork: null,
  messages: [], // { role: 'assistant' | 'user', content }
  turns: 0, // 학생이 대답한 횟수
  busy: false, // 답변을 기다리는 중
  ended: false, // 대화 끝내기를 눌렀는지
  chatStartedAt: null, // 첫 대답을 보낸 시각
  chatEndedAt: null, // '대화 끝내기'를 누른 시각
  submitting: false,
  submitted: false,
}

const secondsBetween = (start, end) => Math.round((end - start) / 1000)

// ---------- 화면 전환 ----------
function showSection(section) {
  for (const s of [el.keySection, el.pickSection, el.chatSection]) {
    s.hidden = s !== section
  }
  window.scrollTo({ top: 0 })
  if (section === el.pickSection) markSubmittedArtworks()
}

// 이미 제출한 작품은 다시 고를 수 없게 표시
async function markSubmittedArtworks() {
  const cards = el.artworkList.querySelectorAll('.artwork-card')
  await Promise.all(
    [...cards].map(async (card) => {
      try {
        const done = await hasSubmitted(state.user.uid, card.dataset.id)
        card.disabled = done
        card.classList.toggle('is-submitted', done)
      } catch (error) {
        console.error(error) // 확인에 실패해도 고르기는 가능 (중복 제출은 보안 규칙이 막음)
      }
    }),
  )
}

// ---------- 1. API Key 확인 ----------
async function handleKey(apiKey) {
  el.keySubmit.disabled = true
  el.keyMessage.className = 'form-message'
  el.keyMessage.textContent = '키를 확인하고 있어요...'
  try {
    await verifyApiKey(apiKey)
    el.keyInput.value = ''
    el.keyMessage.textContent = ''
    showSection(el.pickSection)
  } catch (error) {
    forgetApiKey()
    el.keyMessage.className = 'form-message is-error'
    el.keyMessage.textContent = friendlyError(error)
  } finally {
    el.keySubmit.disabled = false
  }
}

el.keyForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const apiKey = el.keyInput.value.trim()
  if (apiKey) handleKey(apiKey)
})

// ---------- 2. 작품 고르기 ----------
function renderArtworks() {
  for (const artwork of ARTWORKS) {
    const item = document.createElement('li')
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'artwork-card'
    card.dataset.id = artwork.id

    const frame = document.createElement('div')
    frame.className = 'artwork-thumb'
    const img = document.createElement('img')
    img.src = artwork.image
    img.alt = `${artwork.artist}, 「${artwork.title}」`
    img.loading = 'lazy'
    img.addEventListener('error', () => frame.classList.add('is-missing'))
    frame.append(img)

    const title = document.createElement('strong')
    title.className = 'artwork-title'
    title.textContent = `「${artwork.title}」`

    const meta = document.createElement('span')
    meta.className = 'artwork-meta'
    meta.textContent = `${artwork.artist} · ${artwork.year}`

    card.append(frame, title, meta)
    item.append(card)
    el.artworkList.append(item)
  }
}

el.artworkList.addEventListener('click', (event) => {
  const card = event.target.closest('.artwork-card')
  if (card) startChat(findArtwork(card.dataset.id))
})

// ---------- 3. 대화하기 ----------
function startChat(artwork) {
  state.artwork = artwork
  state.messages = []
  state.turns = 0
  state.busy = false
  state.ended = false
  state.chatStartedAt = null
  state.chatEndedAt = null
  state.submitting = false
  state.submitted = false

  el.viewerImage.src = artwork.image
  el.viewerImage.alt = `${artwork.artist}, 「${artwork.title}」`
  el.viewerImage.parentElement.classList.remove('is-missing')
  el.viewerTitle.textContent = `「${artwork.title}」`
  el.viewerArtist.textContent = `${artwork.artist}, ${artwork.year}`

  el.chatLog.replaceChildren()
  el.chatInput.value = ''
  el.reflectionInput.value = ''
  el.reflectionInput.readOnly = false
  el.reflectionSubmit.disabled = false
  el.reflectionSubmit.textContent = '제출하기'
  el.reflectionMessage.textContent = ''
  updateReflectionCount()
  el.chatForm.hidden = false
  el.chatActions.hidden = false
  el.reflectionForm.hidden = true
  el.doneBox.hidden = true
  el.changeArtwork.hidden = false

  addMessage('assistant', openingMessage(artwork))
  showSection(el.chatSection)
  updateChatControls()
  el.chatInput.focus()
}

el.viewerImage.addEventListener('error', () => {
  el.viewerImage.parentElement.classList.add('is-missing')
})

function addMessage(role, content) {
  state.messages.push({ role, content })
  appendBubble(role, content)
}

function appendBubble(role, content, extraClass = '') {
  const bubble = document.createElement('li')
  bubble.className = `bubble bubble-${role} ${extraClass}`.trim()
  bubble.textContent = content
  el.chatLog.append(bubble)
  el.chatLog.scrollTop = el.chatLog.scrollHeight
  return bubble
}

function updateChatControls() {
  const reachedMax = state.turns >= MAX_TURNS
  const canEnd = state.turns >= MIN_TURNS && !state.busy

  el.turnCounter.textContent = `나의 대답 ${state.turns} / ${MAX_TURNS}`
  el.chatInput.disabled = state.busy || reachedMax || state.ended
  el.chatSend.disabled = el.chatInput.disabled
  el.chatEnd.disabled = !canEnd

  if (state.busy) {
    el.chatHint.textContent = '감상 도우미가 생각하고 있어요...'
  } else if (reachedMax) {
    el.chatHint.textContent = '이야기를 충분히 나눴어요! "대화 끝내기"를 눌러 주세요.'
  } else if (state.turns >= MIN_TURNS) {
    el.chatHint.textContent = '더 이야기해도 좋고, 이제 "대화 끝내기"를 눌러도 좋아요.'
  } else {
    el.chatHint.textContent = `${MIN_TURNS - state.turns}번 더 대답하면 대화를 끝낼 수 있어요.`
  }
}

async function sendAnswer() {
  const text = el.chatInput.value.trim()
  if (!text || state.busy || state.turns >= MAX_TURNS) return

  if (state.chatStartedAt === null) state.chatStartedAt = Date.now()
  addMessage('user', text)
  state.turns += 1
  state.busy = true
  el.chatInput.value = ''
  el.changeArtwork.hidden = true
  updateChatControls()

  const typing = appendBubble('assistant', '...', 'is-typing')
  try {
    const reply = await getReply(state.artwork, state.messages, state.turns)
    typing.remove()
    addMessage('assistant', reply)
  } catch (error) {
    // 보낸 대답을 되돌려서 다시 보낼 수 있게 하기
    typing.remove()
    state.messages.pop()
    el.chatLog.lastElementChild?.remove()
    state.turns -= 1
    el.chatInput.value = text
    if (state.turns === 0) {
      el.changeArtwork.hidden = false
      state.chatStartedAt = null
    }
    appendBubble('assistant', friendlyError(error), 'is-error')
  } finally {
    state.busy = false
    updateChatControls()
    if (!el.chatInput.disabled) el.chatInput.focus()
  }
}

el.chatForm.addEventListener('submit', (event) => {
  event.preventDefault()
  sendAnswer()
})

// Enter: 보내기, Shift+Enter: 줄바꿈 (한글 입력 중에는 무시)
el.chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    sendAnswer()
  }
})

el.changeArtwork.addEventListener('click', () => {
  showSection(el.pickSection)
})

// ---------- 4. 한 문장 감상 쓰기 ----------
el.chatEnd.addEventListener('click', () => {
  state.ended = true
  state.chatEndedAt = Date.now()
  el.chatForm.hidden = true
  el.chatActions.hidden = true
  el.reflectionForm.hidden = false
  updateChatControls()
  el.reflectionInput.focus()
  el.reflectionForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

function updateReflectionCount() {
  const max = el.reflectionInput.maxLength
  el.reflectionCount.textContent = `${el.reflectionInput.value.length} / ${max}`
}

el.reflectionInput.addEventListener('input', updateReflectionCount)

el.reflectionForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  // 이미 제출했거나 제출 중이면 다시 보내지 않기
  if (state.submitted || state.submitting) return

  const reflection = el.reflectionInput.value.trim()
  if (!reflection) return

  state.submitting = true
  el.reflectionSubmit.disabled = true
  el.reflectionInput.readOnly = true
  el.reflectionMessage.className = 'form-message'
  el.reflectionMessage.textContent = '제출하고 있어요...'

  const now = Date.now()
  const { id, artist, title, year } = state.artwork
  try {
    await submitReflection({
      uid: state.user.uid,
      name: state.user.displayName || '',
      email: state.user.email || '',
      artwork: { id, artist, title, year },
      messages: state.messages,
      reflection,
      chatDurationSec: secondsBetween(state.chatStartedAt, state.chatEndedAt),
      writingDurationSec: secondsBetween(state.chatEndedAt, now),
    })
    state.submitted = true
    el.reflectionSubmit.textContent = '제출 완료'
    el.reflectionMessage.textContent = ''
    el.doneBox.hidden = false
    el.doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (error) {
    console.error(error)
    el.reflectionSubmit.disabled = false
    el.reflectionInput.readOnly = false
    el.reflectionMessage.className = 'form-message is-error'
    let message = '제출하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'
    if (error.code === 'permission-denied') {
      const already = await hasSubmitted(state.user.uid, id).catch(() => false)
      message = already
        ? '이 작품은 이미 감상을 제출했어요. 다른 작품을 골라 주세요.'
        : '저장할 권한이 없어요. 선생님께 알려 주세요.'
    }
    el.reflectionMessage.textContent = message
  } finally {
    state.submitting = false
  }
})

// ---------- 시작: 로그인 확인 ----------
let started = false

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // 로그인하지 않았으면 메인 페이지로 이동
    location.replace('./index.html')
    return
  }

  state.user = user
  el.userName.textContent = user.displayName || '이름 없음'
  el.userEmail.textContent = user.email || ''

  if (started) return
  started = true
  el.authLoading.hidden = true
  renderArtworks()
  showSection(el.keySection)

  const savedKey = getSavedApiKey()
  if (savedKey) handleKey(savedKey)
})
