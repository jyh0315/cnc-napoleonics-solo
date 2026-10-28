// 사용법: node build.mjs   →  src/ 를 합쳐 index.html 한 파일을 만든다 (의존성 없음)
import { readFileSync, writeFileSync } from 'node:fs';
const src = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const js = ['data.js', 'scen_ex.js', 'scen_ex2.js', 'engine.js', 'flow.js', 'fx.js', 'net.js', 'ui.js'].map(src).join('\n');
const body = src('shell.html')
  .replace('%%RULES%%', () => src('rules.html'))
  .replace('%%SOLO%%', () => src('guide.html'))
  .replace('%%JS%%', () => js);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Commands & Colors: Napoleonics 기본판 15개 시나리오를 웹에서 솔로(Power of Three), 한 기기 2인, 온라인 2인으로 플레이하는 비공식 도구">
<script src="firebase-config.js"></script>
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`index.html 생성 (${(html.length / 1024).toFixed(0)} KB)`);
