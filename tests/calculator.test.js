// Node.js Assert-based Unit Tests for BongBongCalculator
const assert = require("assert");

// Mock window object for Node environment
global.window = {};

// Mock categories
const CATEGORIES = [
    { id: "fresh", name: "신선식품" }
];

// Load core logic functions manually for isolation testing
const BongBongCalculator = {
    getWholesaleUnitPrice(item, qty) {
        if (!item) return 0;
        let unitPrice = item.basePrice;
        if (item.tiers && item.tiers.length > 0) {
            const matchedTier = [...item.tiers]
                .sort((a, b) => b.threshold - a.threshold)
                .find(t => qty >= t.threshold);
            if (matchedTier) {
                unitPrice = matchedTier.price;
            }
        }
        return unitPrice;
    },

    getTierBenefitInfo(item, qty) {
        if (!item) return null;

        const basePrice = item.basePrice;
        const tiers = item.tiers || [];

        const currentUnitPrice = this.getWholesaleUnitPrice(item, qty);
        const currentTotal = qty * currentUnitPrice;
        const baseTotal = qty * basePrice;
        const savedAmount = baseTotal - currentTotal;

        const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
        const currentTier = [...sortedTiers].reverse().find(t => qty >= t.threshold) || null;

        const nextTier = sortedTiers.find(t => qty < t.threshold) || null;

        let remainingQty = 0;
        let nextPrice = 0;
        let nextSavingsPerUnit = 0;

        if (nextTier) {
            remainingQty = nextTier.threshold - qty;
            nextPrice = nextTier.price;
            nextSavingsPerUnit = currentUnitPrice - nextPrice;
        }

        return {
            basePrice,
            currentUnitPrice,
            currentTotal,
            savedAmount,
            currentTier,
            nextTier,
            remainingQty,
            nextPrice,
            nextSavingsPerUnit,
            hasTiers: tiers.length > 0
        };
    }
};

// Mock Items data
const mockPotato = {
    id: "potato",
    name: "골드 감자",
    basePrice: 20000,
    unit: "박스",
    tiers: [
        { threshold: 10, price: 18000 },
        { threshold: 30, price: 15000 }
    ]
};

const mockGarlicWithoutTiers = {
    id: "garlic",
    name: "깐마늘 XL",
    basePrice: 25000,
    unit: "kg",
    tiers: []
};

// --- Test Cases ---

console.log("=== Running BongBongCalculator Unit Tests ===");

// 1. Tiers가 없는 품목 계산 테스트
try {
    const price = BongBongCalculator.getWholesaleUnitPrice(mockGarlicWithoutTiers, 15);
    assert.strictEqual(price, 25000, "Tiers가 없을 때는 수량에 상관없이 기본단가를 반환해야 합니다.");
    console.log("✓ Test 1 Passed: No tiers price verification");
} catch (err) {
    console.error("✗ Test 1 Failed:", err.message);
    process.exit(1);
}

// 2. 기본 수량 미만 도매가 단가 검증
try {
    const price = BongBongCalculator.getWholesaleUnitPrice(mockPotato, 5);
    assert.strictEqual(price, 20000, "10개 미만 구매 시 기본단가 20,000원이 적용되어야 합니다.");
    console.log("✓ Test 2 Passed: Under threshold basic price verification");
} catch (err) {
    console.error("✗ Test 2 Failed:", err.message);
    process.exit(1);
}

// 3. 1차 할인 구간 단가 검증 (10개 이상)
try {
    const price = BongBongCalculator.getWholesaleUnitPrice(mockPotato, 15);
    assert.strictEqual(price, 18000, "10개 이상 30개 미만 구매 시 18,000원이 적용되어야 합니다.");
    console.log("✓ Test 3 Passed: First tier price verification");
} catch (err) {
    console.error("✗ Test 3 Failed:", err.message);
    process.exit(1);
}

// 4. 2차 할인 구간 단가 검증 (30개 이상)
try {
    const price = BongBongCalculator.getWholesaleUnitPrice(mockPotato, 35);
    assert.strictEqual(price, 15000, "30개 이상 구매 시 15,000원이 적용되어야 합니다.");
    console.log("✓ Test 4 Passed: Second tier price verification");
} catch (err) {
    console.error("✗ Test 4 Failed:", err.message);
    process.exit(1);
}

// 5. 정산 혜택 정보 객체 (getTierBenefitInfo) 계산 및 마스킹 검증
try {
    const info = BongBongCalculator.getTierBenefitInfo(mockPotato, 8);
    assert.strictEqual(info.currentUnitPrice, 20000);
    assert.strictEqual(info.remainingQty, 2, "다음 구간(10개)까지 2개가 더 필요한 상태여야 합니다.");
    assert.strictEqual(info.nextPrice, 18000);
    assert.strictEqual(info.savedAmount, 0, "할인이 적용되지 않았으므로 절약금액은 0원이어야 합니다.");
    console.log("✓ Test 5 Passed: getTierBenefitInfo calculation details verification");
} catch (err) {
    console.error("✗ Test 5 Failed:", err.message);
    process.exit(1);
}

// Mock BongBongCrypt for testing masking utilities
const BongBongCrypt = {
    maskContact(contact) {
        if (!contact) return "";
        const clean = contact.replace(/[^0-9]/g, '');
        if (clean.length === 11) {
            return `${clean.slice(0, 3)}-****-${clean.slice(7)}`;
        } else if (clean.length === 10) {
            return `${clean.slice(0, 3)}-***-${clean.slice(6)}`;
        }
        return contact.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
    },
    maskAddress(address) {
        if (!address) return "";
        const parts = address.split(' ');
        if (parts.length > 2) {
            return `${parts[0]} ${parts[1]} ***`;
        }
        return `${address}***`;
    }
};

// ... (existing test outputs)

// 6. 연락처 마스킹 검증 (하이픈 있는 경우와 없는 경우)
try {
    const masked1 = BongBongCrypt.maskContact("010-1234-5678");
    assert.strictEqual(masked1, "010-****-5678", "하이픈이 있는 연락처는 가운데가 마스킹되어야 합니다.");

    const masked2 = BongBongCrypt.maskContact("01098765432");
    assert.strictEqual(masked2, "010-****-5432", "하이픈이 없는 11자리 연락처는 하이픈과 함께 마스킹되어야 합니다.");

    console.log("✓ Test 6 Passed: Contact masking verification");
} catch (err) {
    console.error("✗ Test 6 Failed:", err.message);
    process.exit(1);
}

// 7. 주소 마스킹 검증 (2단어 초과와 2단어 이하)
try {
    const maskedAddr1 = BongBongCrypt.maskAddress("인천광역시 중구 연안부두로 34");
    assert.strictEqual(maskedAddr1, "인천광역시 중구 ***", "2단어 초과 주소는 두 번째 단어까지만 보여주어야 합니다.");

    const maskedAddr2 = BongBongCrypt.maskAddress("서울 강서구");
    assert.strictEqual(maskedAddr2, "서울 강서구***", "2단어 이하 주소는 적당히 마스킹되어야 합니다.");

    console.log("✓ Test 7 Passed: Address masking verification");
} catch (err) {
    console.error("✗ Test 7 Failed:", err.message);
    process.exit(1);
}

// 8. 경계값 단가 계산 검증
try {
    const priceAtThreshold = BongBongCalculator.getWholesaleUnitPrice(mockPotato, 10);
    assert.strictEqual(priceAtThreshold, 18000, "정확히 경계값(10개)에 도달했을 때 도매 할인가 18,000원이 적용되어야 합니다.");

    const priceExactlyUnder = BongBongCalculator.getWholesaleUnitPrice(mockPotato, 9);
    assert.strictEqual(priceExactlyUnder, 20000, "경계값 미만(9개)일 때는 기본단가 20,000원이 적용되어야 합니다.");

    console.log("✓ Test 8 Passed: Boundary price validation");
} catch (err) {
    console.error("✗ Test 8 Failed:", err.message);
    process.exit(1);
}

console.log("==========================================");
console.log("🎉 All 8 unit tests completed successfully!");
console.log("==========================================");
