# Manna

매일 성경을 정해진 장 수만큼 읽고, AI가 쉬운 요약과 핵심 메시지를 정리해 주는 웹 앱입니다.

## 기능

- 마지막으로 읽은 곳 다음 장부터 하루 분량을 보여줘요
- Claude API로 쉬운 요약 3줄, 핵심 구절, 핵심 메시지를 받아요
- 다 읽으면 기록되고, 달력에서 지난 날의 요약과 본문을 다시 볼 수 있어요
- 기록 내보내기와 불러오기로 백업해요
- 화면 언어는 한국어와 English, 번역본은 개역한글과 World English Bible(WEB) 중에서 골라요. 요약은 번역본의 언어로 나와요

## GitHub Pages에 올리기

1. GitHub에서 새 저장소를 만들어요. 예를 들어 `manna`
2. 이 폴더 안의 파일을 모두 그대로 올려요. `data` 폴더도 포함해서요
3. 저장소 Settings › Pages에서 Branch를 `main`, 폴더를 `/ (root)`로 정하고 저장해요
4. 잠시 뒤 `https://yeochoi.github.io/manna/`에서 열려요
5. 아이폰 Safari에서 열고 공유 › 홈 화면에 추가를 눌러 앱처럼 써요

## AI 요약 켜기

1. https://console.anthropic.com 에서 API 키를 만들고 크레딧을 조금 충전해요
2. 앱의 설정 › Claude API 키에 붙여넣고 저장해요
3. 키는 이 기기의 브라우저에만 저장되고 저장소에는 올라가지 않아요

## 구조

- `index.html`, `styles.css` 화면과 디자인
- `i18n.js` 모든 화면 문구. 영어는 여기에 `en` 블록만 추가하면 돼요
- `summary.js` AI 요약 요청. 나중에 앱으로 만들 때 이 파일만 서버 호출로 바꾸면 돼요
- `app.js` 읽기, 기록, 설정 동작
- `data/krv/`, `data/web/` 개역한글과 WEB 본문, 권별 66개 파일
- `data/books.json` 책 이름과 장 수

## 출처

개역한글판(1961)과 World English Bible 모두 퍼블릭 도메인입니다.
