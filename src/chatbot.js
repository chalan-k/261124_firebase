// OpenAI API 연결 (브라우저에서 직접 호출)
import OpenAI from 'openai'
import { buildInstructions } from './prompts.js'

// GPT-5 계열 경량 모델
export const MODEL = 'gpt-5-mini'

const KEY_STORAGE = 'openai-api-key'
let client = null

function createClient(apiKey) {
  return new OpenAI({
    apiKey,
    // 서버 함수 없이 브라우저에서 키를 직접 사용하므로 필요한 옵션
    dangerouslyAllowBrowser: true,
  })
}

// 키가 유효하고 사용할 모델에 접근할 수 있는지 확인
export async function verifyApiKey(apiKey) {
  const candidate = createClient(apiKey)
  await candidate.models.retrieve(MODEL)
  client = candidate
  sessionStorage.setItem(KEY_STORAGE, apiKey) // 탭을 닫으면 지워짐
}

export function getSavedApiKey() {
  return sessionStorage.getItem(KEY_STORAGE)
}

export function forgetApiKey() {
  sessionStorage.removeItem(KEY_STORAGE)
  client = null
}

// messages: [{ role: 'assistant' | 'user', content: string }]
// turn: 학생이 지금까지 대답한 횟수
export async function getReply(artwork, messages, turn) {
  if (!client) throw new Error('API Key가 확인되지 않았습니다.')

  const response = await client.responses.create({
    model: MODEL,
    instructions: buildInstructions(artwork, turn),
    input: messages.map(({ role, content }) => ({ role, content })),
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
  })

  return response.output_text.trim()
}

// 오류를 학생이 이해하기 쉬운 문장으로 바꾸기
export function friendlyError(error) {
  const status = error?.status
  if (status === 401) return 'API Key가 올바르지 않아요. 선생님께 다시 확인해 주세요.'
  if (status === 403 || status === 404) return '이 키로는 감상 도우미 모델을 사용할 수 없어요. 선생님께 알려 주세요.'
  if (status === 429) return '지금 이용하는 사람이 많거나 사용량이 다 찼어요. 잠시 뒤에 다시 해 보세요.'
  if (!navigator.onLine) return '인터넷 연결을 확인해 주세요.'
  return '감상 도우미와 연결하지 못했어요. 잠시 뒤에 다시 해 보세요.'
}
