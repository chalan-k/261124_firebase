// 메인 페이지: Google 로그인 관리
import './styles.css'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebaseConfig.js'
import { isAdmin } from './adminConfig.js'

const loading = document.getElementById('auth-loading')
const signedOut = document.getElementById('signed-out')
const signedIn = document.getElementById('signed-in')
const loginButton = document.getElementById('login-button')
const logoutButton = document.getElementById('logout-button')
const userName = document.getElementById('user-name')
const teacherButton = document.getElementById('teacher-button')
const authError = document.getElementById('auth-error')

// 로그인 상태에 따라 버튼 보이기/숨기기
onAuthStateChanged(auth, (user) => {
  loading.hidden = true
  signedOut.hidden = Boolean(user)
  signedIn.hidden = !user
  if (user) userName.textContent = user.displayName || user.email
  teacherButton.hidden = !isAdmin(user) // 관리자 UID일 때만 '교사 모니터링' 버튼 보이기
})

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true
  authError.textContent = ''
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (error) {
    // 사용자가 로그인 창을 닫은 경우는 안내하지 않음
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      console.error(error)
      authError.textContent =
        error.code === 'auth/popup-blocked'
          ? '팝업이 차단되었어요. 브라우저에서 팝업을 허용해 주세요.'
          : '로그인하지 못했어요. 잠시 뒤에 다시 해 보세요.'
    }
  } finally {
    loginButton.disabled = false
  }
})

logoutButton.addEventListener('click', () => signOut(auth))
