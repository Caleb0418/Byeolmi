// 경량 테스트 유틸 (외부 의존성 없이 Node 내장 assert 기반)
// 각 테스트 파일은 createSuite로 독립 스위트를 만들어 사용한다.
const assert = require("assert");

function createSuite(title) {
    let passed = 0;
    let failed = 0;
    console.log(`=== ${title} ===`);
    return {
        test(name, fn) {
            try {
                fn();
                passed += 1;
                console.log(`  ✓ ${name}`);
            } catch (err) {
                failed += 1;
                console.error(`  ✗ ${name}: ${err.message}`);
            }
        },
        done() {
            console.log(`--- ${title}: ${passed} passed, ${failed} failed ---\n`);
            if (failed > 0) process.exitCode = 1;
        }
    };
}

// app.js를 Node 환경에서 로드 (브라우저 전역 window를 목으로 제공).
// app.js 는 window.z / window.supabase 가 없으면 해당 기능을 건너뛰므로 순수 로직만 안전하게 로드된다.
function loadApp() {
    if (!global.window) global.window = {};
    return require("../app.js");
}

module.exports = { assert, createSuite, loadApp };
