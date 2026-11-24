// 감상할 작품 목록
// 이미지 파일은 public/images/ 폴더에 넣으면 /images/파일명 주소로 사용할 수 있습니다.
export const ARTWORKS = [
  {
    id: 'matisse',
    artist: '앙리 마티스',
    title: '춤',
    year: 1910,
    image: '/images/matisse.jpg',
  },
  {
    id: 'mondrian',
    artist: '피에트 몬드리안',
    title: '빨강, 파랑, 노랑의 구성',
    year: 1930,
    image: '/images/mondrian.jpg',
  },
  {
    id: 'munch',
    artist: '에드바르 뭉크',
    title: '절규',
    year: 1893,
    image: '/images/munch.jpg',
  },
]

export function findArtwork(id) {
  return ARTWORKS.find((artwork) => artwork.id === id)
}
