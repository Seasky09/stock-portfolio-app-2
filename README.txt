# 주식관리 웹앱 최소형

## 1. GitHub에 올리기
이 압축을 풀고, 파일 전체를 GitHub 새 저장소에 업로드합니다.

## 2. Vercel 배포
1) Vercel에서 New Project
2) 방금 만든 GitHub 저장소 선택
3) Environment Variables에 아래 두 개 추가
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
4) Deploy 클릭

## 3. Supabase 준비
이미 SQL 실행과 Email 로그인 활성화를 해두셨으면 됩니다.

## 4. Vercel 환경변수 값
- VITE_SUPABASE_URL = https://프로젝트주소.supabase.co
- VITE_SUPABASE_ANON_KEY = Publishable key

## 5. 로그인
배포 후 앱 첫 화면에서 이메일을 입력하고 로그인 링크를 받으면 됩니다.
