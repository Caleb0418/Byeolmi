// BongBongCrypt 단위 테스트 — P0-2 정책(평문 저장 + 마스킹 + 레거시 암호문 안전 처리) 검증
const { assert, createSuite, loadApp } = require("./_util");

const { BongBongCrypt } = loadApp();
const suite = createSuite("BongBongCrypt");

// --- encrypt: 평문 패스스루 ---

suite.test("encrypt는 입력을 그대로 반환(평문 저장)", () => {
    assert.strictEqual(BongBongCrypt.encrypt("010-1234-5678"), "010-1234-5678");
});

suite.test("encrypt(빈값/null)은 빈 문자열 반환", () => {
    assert.strictEqual(BongBongCrypt.encrypt(""), "");
    assert.strictEqual(BongBongCrypt.encrypt(null), "");
    assert.strictEqual(BongBongCrypt.encrypt(undefined), "");
});

// --- decrypt ---

suite.test("decrypt는 평문을 그대로 반환", () => {
    assert.strictEqual(BongBongCrypt.decrypt("010-1234-5678"), "010-1234-5678");
});

suite.test("decrypt(빈값)은 빈 문자열 반환", () => {
    assert.strictEqual(BongBongCrypt.decrypt(""), "");
    assert.strictEqual(BongBongCrypt.decrypt(null), "");
});

suite.test("레거시 AES 암호문(U2FsdGVk 접두)은 복호화 불가 → 빈 문자열", () => {
    // CryptoJS AES 암호문은 'Salted__' base64 인 'U2FsdGVkX1...' 형태
    assert.strictEqual(BongBongCrypt.decrypt("U2FsdGVkX1+abcdef=="), "");
});

// --- maskContact ---

suite.test("maskContact는 가운데 자리를 마스킹", () => {
    assert.strictEqual(BongBongCrypt.maskContact("010-1234-5678"), "010-****-5678");
    assert.strictEqual(BongBongCrypt.maskContact("010-123-4567"), "010-****-4567");
});

suite.test("maskContact(빈값)은 빈 문자열 반환", () => {
    assert.strictEqual(BongBongCrypt.maskContact(""), "");
    assert.strictEqual(BongBongCrypt.maskContact(null), "");
});

suite.test("형식이 맞지 않는 입력은 그대로 반환(예외 없이)", () => {
    assert.strictEqual(BongBongCrypt.maskContact("이름없음"), "이름없음");
});

suite.done();
