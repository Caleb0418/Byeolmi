// Item category helper tests — owner-defined categories should stay dynamic while legacy defaults remain compatible.
const { assert, createSuite, loadApp } = require("./_util");

const { getCategoryId, getCategoryLabel, buildCategoryOptions } = loadApp();
const suite = createSuite("ItemCategories");

suite.test("기본 분류 라벨은 기존 ID로 정규화된다", () => {
    assert.strictEqual(getCategoryId("신선식품"), "fresh");
    assert.strictEqual(getCategoryLabel("fresh"), "신선식품");
});

suite.test("사용자 정의 분류는 그대로 보존된다", () => {
    assert.strictEqual(getCategoryId("냉동 식품"), "냉동 식품");
    assert.strictEqual(getCategoryLabel("냉동 식품"), "냉동 식품");
});

suite.test("품목에 쓰인 분류만 옵션으로 만든다", () => {
    const options = buildCategoryOptions([
        { category: "fresh" },
        { category: "냉동식품" },
        { category: "fresh" }
    ]);
    assert.deepStrictEqual(options, [
        { id: "fresh", name: "신선식품" },
        { id: "냉동식품", name: "냉동식품" }
    ]);
});

suite.test("관리자 입력 추천에는 기본 분류를 포함할 수 있다", () => {
    const options = buildCategoryOptions([{ category: "냉동식품" }], { includeDefaults: true });
    assert(options.some(category => category.id === "fresh"));
    assert(options.some(category => category.id === "냉동식품"));
});

suite.done();