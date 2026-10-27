// 온라인 2인 대전용 Firebase 설정.
// Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹 앱 → "SDK 설정 및 구성"의 "구성"(Config) 값을 아래에 붙여 넣는다.
// databaseURL 이 꼭 있어야 한다 (Realtime Database를 만든 뒤에 구성 값에 나타난다).
// 이 값들은 공개되어도 되는 값이다. 실제 보호는 database.rules.json 보안 규칙이 맡는다.
// 비워 두면(null) 솔로와 한 기기 2인만 쓸 수 있다.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCd5gBNm8gE-TO-aunKI6IOArjyXlHMJjU",
  authDomain: "wargame-88aa9.firebaseapp.com",
  databaseURL: "https://wargame-88aa9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wargame-88aa9",
  appId: "1:811762088534:web:83b14a30ed37fc253459f7"
};

/* 예시 — 주석을 풀고 내 값으로 바꾼다
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "my-cnc.firebaseapp.com",
  databaseURL: "https://my-cnc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-cnc",
  appId: "1:1234567890:web:abcdef"
};
*/
