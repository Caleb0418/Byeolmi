/**
 * BongBong Market - Core Application State & Business Logic (Mock)
 * 공동구매 구간 단가 및 게이지바 로직을 완전히 삭제하고,
 * B2B 도매 거래처 주문 관리 및 정산 시스템으로 데이터 로직을 전면 단순화했습니다.
 */

// 1. 카테고리 정의
const CATEGORIES = [
    { id: "fresh", name: "신선식품" },
    { id: "easy", name: "간편조리" },
    { id: "snack", name: "간식" },
    { id: "living", name: "생활용품" }
];

// 2. 도매 기본 단가 테이블 정의 (수량별 차등 단가 tiers 포함)
const DEFAULT_ITEMS = [
    {
        id: "potato",
        category: "fresh",
        name: "올바른 골드 감자 (10kg)",
        basePrice: 18000,
        unit: "박스",
        tiers: [
            { threshold: 10, price: 17000 },
            { threshold: 20, price: 16000 }
        ]
    },
    {
        id: "onion",
        category: "fresh",
        name: "국산 햇 빨간 양파 (5kg)",
        basePrice: 10500,
        unit: "박스",
        tiers: [
            { threshold: 10, price: 9500 }
        ]
    },
    {
        id: "garlic",
        category: "fresh",
        name: "의성 깐마늘 XL (3kg)",
        basePrice: 38000,
        unit: "박스",
        tiers: [
            { threshold: 10, price: 36000 }
        ]
    },
    {
        id: "meal-kit",
        category: "easy",
        name: "봉봉 부대찌개 밀키트 (3인분)",
        basePrice: 13500,
        unit: "팩",
        tiers: []
    },
    {
        id: "sweet-potato-chew",
        category: "snack",
        name: "말랑말랑 고구마 말랭이 (10봉)",
        basePrice: 16000,
        unit: "박스",
        tiers: []
    },
    {
        id: "eco-bag",
        category: "living",
        name: "친환경 생분해 포장봉투 (500매)",
        basePrice: 22000,
        unit: "롤",
        tiers: []
    }
];

const DEFAULT_ORDERS = [
    { id: 1, buyerName: "김선호", itemId: "potato", qty: 5, time: "14:22", status: "확정" },
    { id: 2, buyerName: "박민지 (맘공구)", itemId: "onion", qty: 12, time: "14:15", status: "대기" },
    { id: 3, buyerName: "이정재", itemId: "potato", qty: 20, time: "13:45", status: "배송중" },
    { id: 4, buyerName: "최유진 (마트)", itemId: "garlic", qty: 8, time: "13:30", status: "확정" },
    { id: 5, buyerName: "정해인", itemId: "potato", qty: 15, time: "13:10", status: "대기" }
];

// 과거 정산 분석용 데이터
const ANALYTICS_DATA = {
    monthly: {
        labels: ["12월", "1월", "2월", "3월", "4월", "5월"],
        sales: [18400000, 22100000, 19500000, 25600000, 28900000, 32450000],
        volumes: [980, 1120, 950, 1280, 1380, 1540]
    },
    weekly: {
        labels: ["1주차", "2주차", "3주차", "4주차", "5주차"],
        sales: [5800000, 6200000, 7100000, 6800000, 6550000],
        volumes: [280, 310, 340, 320, 315]
    },
    daily: {
        labels: ["22일", "23일", "24일", "25일", "26일", "27일", "28일"],
        sales: [980000, 1200000, 850000, 1450000, 1100000, 1320000, 1240000],
        volumes: [48, 60, 42, 72, 55, 66, 62]
    },
    buyers: [
        { name: "박민지 (맘공구)", mainItem: "골드 감자", qty: 340, revenue: 6120000, status: "정상" },
        { name: "최유진 (마트)", mainItem: "깐마늘 XL", qty: 180, revenue: 4200000, status: "미수금 ₩120,000" },
        { name: "이정재 (대형유통)", mainItem: "골드 감자", qty: 250, revenue: 3750000, status: "정상" },
        { name: "김선호 (야채상)", mainItem: "빨간 양파", qty: 140, revenue: 1680000, status: "정상" },
        { name: "정해인 (식자재)", mainItem: "골드 감자", qty: 95, revenue: 1425000, status: "정상" }
    ]
};

// LocalStorage 입출력 제어 클래스
class BongBongStore {
    static getCategories() {
        return CATEGORIES;
    }

    static getItems() {
        const items = localStorage.getItem("bb_items");
        if (!items) {
            localStorage.setItem("bb_items", JSON.stringify(DEFAULT_ITEMS));
            return DEFAULT_ITEMS;
        }
        return JSON.parse(items);
    }

    static saveItems(items) {
        localStorage.setItem("bb_items", JSON.stringify(items));
    }

    static addItem(item) {
        const items = this.getItems();
        items.push(item);
        this.saveItems(items);
        this.dispatchStorageChange();
    }

    static updateItem(itemId, updatedItem) {
        let items = this.getItems();
        items = items.map(item => item.id === itemId ? { ...item, ...updatedItem } : item);
        this.saveItems(items);
        this.dispatchStorageChange();
    }

    static deleteItem(itemId) {
        let items = this.getItems();
        items = items.filter(item => item.id !== itemId);
        this.saveItems(items);
        this.dispatchStorageChange();
    }

    static getOrders() {
        const orders = localStorage.getItem("bb_orders");
        if (!orders) {
            localStorage.setItem("bb_orders", JSON.stringify(DEFAULT_ORDERS));
            return DEFAULT_ORDERS;
        }
        return JSON.parse(orders);
    }

    static saveOrders(orders) {
        localStorage.setItem("bb_orders", JSON.stringify(orders));
    }

    static isClosed() {
        return localStorage.getItem("bb_is_closed") === "true";
    }

    static setClosedStatus(status) {
        localStorage.setItem("bb_is_closed", status ? "true" : "false");
    }

    static addOrder(buyerName, itemId, qty) {
        const orders = this.getOrders();
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const newOrder = {
            id: Date.now(),
            buyerName,
            itemId,
            qty: parseInt(qty, 10),
            time: timeStr,
            status: "대기"
        };
        orders.unshift(newOrder);
        this.saveOrders(orders);
        this.dispatchStorageChange();
        return newOrder;
    }

    static updateOrderStatus(orderId, status) {
        let orders = this.getOrders();
        orders = orders.map(order => order.id === orderId ? { ...order, status } : order);
        this.saveOrders(orders);
        this.dispatchStorageChange();
    }

    static dispatchStorageChange() {
        window.dispatchEvent(new Event('storage'));
    }

    static getAnalyticsData() {
        return ANALYTICS_DATA;
    }
}

// B2B 정산 계산기 (거래처별 수량에 따른 차등 도매 단가 적용 계산)
class BongBongCalculator {
    static getItemTotalQty(itemId) {
        const orders = BongBongStore.getOrders();
        return orders
            .filter(order => order.itemId === itemId)
            .reduce((sum, order) => sum + order.qty, 0);
    }

    static getWholesaleUnitPrice(item, qty) {
        if (!item) return 0;
        let unitPrice = item.basePrice;
        if (item.tiers && item.tiers.length > 0) {
            // threshold가 qty 이상인 tiers 중 가장 큰 threshold를 가진 tier의 단가 적용
            const matchedTier = [...item.tiers]
                .sort((a, b) => b.threshold - a.threshold)
                .find(t => qty >= t.threshold);
            if (matchedTier) {
                unitPrice = matchedTier.price;
            }
        }
        return unitPrice;
    }

    static getProjectedRevenue() {
        const items = BongBongStore.getItems();
        const orders = BongBongStore.getOrders();
        
        // 거래처별 + 품목별 수량 집계
        const buyerSummary = {};
        orders.forEach(order => {
            if (!buyerSummary[order.buyerName]) {
                buyerSummary[order.buyerName] = {};
            }
            if (!buyerSummary[order.buyerName][order.itemId]) {
                buyerSummary[order.buyerName][order.itemId] = 0;
            }
            buyerSummary[order.buyerName][order.itemId] += order.qty;
        });

        let totalRevenue = 0;
        for (const [buyer, itemQtyMap] of Object.entries(buyerSummary)) {
            for (const [itemId, totalQty] of Object.entries(itemQtyMap)) {
                const item = items.find(i => i.id === itemId);
                const price = this.getWholesaleUnitPrice(item, totalQty);
                totalRevenue += totalQty * price;
            }
        }

        return totalRevenue;
    }
}

window.BongBongStore = BongBongStore;
window.BongBongCalculator = BongBongCalculator;
