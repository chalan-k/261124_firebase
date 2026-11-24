// 관리자(교사) 계정 판별
// .env의 VITE_ADMIN_UIDS에 쉼표로 구분해 적은 UID들이 관리자입니다.
export const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '')
  .split(',')
  .map((uid) => uid.trim())
  .filter(Boolean)

if (ADMIN_UIDS.length === 0) {
  console.warn('[관리자] .env의 VITE_ADMIN_UIDS가 비어 있어 관리자 계정이 없습니다.')
}

export function isAdmin(user) {
  return Boolean(user) && ADMIN_UIDS.includes(user.uid)
}
