// 감상 결과를 Firestore의 reflections 컬렉션에 저장
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebaseConfig.js'

export const REFLECTIONS = 'reflections'

// 문서 ID = 학생UID_작품ID → 한 학생이 같은 작품은 한 번만 제출 (보안 규칙에서도 검사)
export function reflectionId(uid, artworkId) {
  return `${uid}_${artworkId}`
}

// 이 학생이 이 작품으로 이미 제출했는지 확인
export async function hasSubmitted(uid, artworkId) {
  const snapshot = await getDoc(doc(db, REFLECTIONS, reflectionId(uid, artworkId)))
  return snapshot.exists()
}

// record 형태:
// {
//   uid, name, email,
//   artwork: { id, artist, title, year },
//   messages: [{ role: 'assistant' | 'user', content }],
//   reflection: '한 문장 감상',
//   chatDurationSec: 첫 대답 전송 ~ '대화 끝내기'까지 걸린 시간(초),
//   writingDurationSec: '대화 끝내기' ~ '제출하기'까지 걸린 시간(초),
// }
export async function submitReflection(record) {
  const id = reflectionId(record.uid, record.artwork.id)
  // 이미 있는 문서에 쓰면 '수정'이 되어 보안 규칙에서 거부됨
  await setDoc(doc(db, REFLECTIONS, id), {
    ...record,
    submittedAt: serverTimestamp(), // 제출 날짜와 시간 (Firebase 서버 기준)
  })
  return id
}
