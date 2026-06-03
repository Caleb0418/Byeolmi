// BongBongCalculator 단위 테스트 — app.js의 실제 프로덕션 로직을 import 하여 검증한다.
const { assert, createSuite, loadApp } = require("./_util");

const { BongBongCalculator } = loadApp();
const suite = createSuite("BongBongCalculator");

// 테스트 픽스처
const potato = {
    id: "potato",
    name: "골드 감자",
    basePrice: 20000,
    unit: "박스",
    tiers: [
        { threshold: 10, price: 18000 },
        { threshold: 30, price: 15000 }
    ]
};

const noTierItem = {
    id: "garlic",
    name: "깐마늘 XL",
    basePrice: 25000,
    unit: "kg",
    tiers: []
};

// --- getWholesaleUnitPrice ---

suite.test("tier가 없으면 수량과 무관하게 기본단가 반환", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(noTierItem, 1), 25000);
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(noTierItem, 999), 25000);
});

suite.test("첫 구간 미만이면 기본단가 적용", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 9), 20000);
});

suite.test("구간 경계값(threshold와 정확히 동일)에서 구간단가 적용", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 10), 18000);
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 30), 15000);
});

suite.test("구간 사이 수량은 하위 구간단가 적용", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 15), 18000);
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 29), 18000);
});

suite.test("최상위 구간 이상이면 최상위 구간단가 유지", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(potato, 1000), 15000);
});

suite.test("tiers 입력 순서가 뒤바뀌어도 올바른 단가 계산", () => {
    const reversed = { ...potato, tiers: [{ threshold: 30, price: 15000 }, { threshold: 10, price: 18000 }] };
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(reversed, 12), 18000);
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(reversed, 35), 15000);
});

suite.test("item이 null이면 0 반환", () => {
    assert.strictEqual(BongBongCalculator.getWholesaleUnitPrice(null, 10), 0);
});

// --- getTierBenefitInfo ---

suite.test("첫 구간 미만: 절약 0, 다음 구간 정보 정확", () => {
    const info = BongBongCalculator.getTierBenefitInfo(potato, 8);
    assert.strictEqual(info.currentUnitPrice, 20000);
    assert.strictEqual(info.savedAmount, 0);
    assert.strictEqual(info.currentTier, null);
    assert.strictEqual(info.remainingQty, 2);
    assert.strictEqual(info.nextPrice, 18000);
    assert.strictEqual(info.nextSavingsPerUnit, 2000);
    assert.strictEqual(info.hasTiers, true);
});

suite.test("첫 구간 적용: 절약금액 = (기본가-구간가) * 수량", () => {
    const info = BongBongCalculator.getTierBenefitInfo(potato, 12);
    assert.strictEqual(info.currentUnitPrice, 18000);
    assert.strictEqual(info.currentTotal, 12 * 18000);
    assert.strictEqual(info.savedAmount, (20000 - 18000) * 12);
    assert.strictEqual(info.currentTier.threshold, 10);
    assert.strictEqual(info.nextTier.threshold, 30);
    assert.strictEqual(info.remainingQty, 18);
});

suite.test("최상위 구간 적용: 다음 구간 없음", () => {
    const info = BongBongCalculator.getTierBenefitInfo(potato, 40);
    assert.strictEqual(info.currentUnitPrice, 15000);
    assert.strictEqual(info.nextTier, null);
    assert.strictEqual(info.remainingQty, 0);
    assert.strictEqual(info.savedAmount, (20000 - 15000) * 40);
});

suite.test("tier 없는 품목: hasTiers=false, 절약 0", () => {
    const info = BongBongCalculator.getTierBenefitInfo(noTierItem, 50);
    assert.strictEqual(info.hasTiers, false);
    assert.strictEqual(info.currentTier, null);
    assert.strictEqual(info.nextTier, null);
    assert.strictEqual(info.savedAmount, 0);
});

suite.test("item이 null이면 null 반환", () => {
    assert.strictEqual(BongBongCalculator.getTierBenefitInfo(null, 10), null);
});

suite.done();
