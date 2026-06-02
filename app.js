/**
 * BongBong Market - Core Application State & Business Logic (Mock & Supabase)
 * 공동구매 구간 단가 및 게이지바 로직을 완전히 삭제하고,
 * B2B 도매 거래처 주문 관리 및 정산 시스템으로 데이터 로직을 전면 단순화했습니다.
 */

// 0. Supabase Client 초기화
const SUPABASE_URL = "https://jobksthdcqslozwrxcxy.supabase.co";
const SUPABASE_KEY = "sb_publishable_2eMUEbeE4AOwCeHzqDXkyA_imFLRVps";
let supabase = null;

if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// 0-1. Zod 스키마 정의 (외부 입력 검증용)
let ItemSchema;
let OrderSchema;

if (window.z) {
    const { z } = window;

    const TierSchema = z.object({
        threshold: z.number().int().positive("기준 수량은 양의 정수여야 합니다."),
        price: z.number().int().nonnegative("단가는 0원 이상이어야 합니다.")
    });

    ItemSchema = z.object({
        id: z.string().min(1, "아이디는 필수입니다."),
        category: z.enum(["fresh", "easy", "snack", "living"]),
        name: z.string().min(1, "품목명은 필수입니다."),
        basePrice: z.number().int().positive("기본 단가는 양의 정수여야 합니다."),
        unit: z.string().min(1, "단위는 필수입니다."),
        isAvailable: z.boolean().optional(),
        tiers: z.array(TierSchema).optional().default([])
    }).refine(data => {
        // 유효성 체크 1: 모든 차등 할인 단가는 기본 판매 단가보다 낮아야 함
        if (data.tiers && data.tiers.length > 0) {
            return data.tiers.every(tier => tier.price < data.basePrice);
        }
        return true;
    }, {
        message: "차등 할인 단가는 기본 판매 단가보다 낮아야 합니다.",
        path: ["tiers"]
    }).refine(data => {
        // 유효성 체크 2: tiers 안에 중복된 threshold가 없어야 함
        if (data.tiers && data.tiers.length > 0) {
            const thresholds = data.tiers.map(t => t.threshold);
            return new Set(thresholds).size === thresholds.length;
        }
        return true;
    }, {
        message: "중복된 기준 수량이 존재합니다.",
        path: ["tiers"]
    });

    OrderSchema = z.object({
        id: z.number().optional(),
        buyerName: z.string().min(1, "대표자명 / 업체명은 필수입니다."),
        itemId: z.string().min(1, "품목을 선택해 주세요."),
        qty: z.number().int().positive("발주 수량은 1개 이상이어야 합니다."),
        time: z.string().optional(),
        status: z.enum(["대기", "승인", "배송중", "완료"]).optional()
    });
}

// 1. 카테고리 정의
const CATEGORIES = [
    { id: "fresh", name: "신선식품" },
    { id: "easy", name: "간편조리" },
    { id: "snack", name: "간식" },
    { id: "living", name: "생활용품" }
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

// LocalStorage 및 Supabase 통합 입출력 제어 클래스
class BongBongStore {
    static getCategories() {
        return CATEGORIES;
    }

    static async getItems() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('bb_items')
            .select('*')
            .order('name');
        
        if (error) {
            console.error("Failed to fetch items:", error);
            throw new Error(error.message);
        }
        
        return data.map(item => ({
            id: item.id,
            category: item.category,
            name: item.name,
            basePrice: item.base_price,
            unit: item.unit,
            isAvailable: item.is_available,
            tiers: item.tiers || []
        }));
    }

    static async addItem(item) {
        if (ItemSchema) {
            ItemSchema.parse(item);
        }
        if (!supabase) return;
        
        const dbItem = {
            id: item.id,
            category: item.category,
            name: item.name,
            base_price: item.basePrice,
            unit: item.unit,
            is_available: item.isAvailable !== false,
            tiers: item.tiers || []
        };

        const { error } = await supabase
            .from('bb_items')
            .insert(dbItem);
            
        if (error) {
            console.error("Failed to add item:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async updateItem(itemId, updatedItem) {
        if (!supabase) return;
        
        const items = await this.getItems();
        const existingItem = items.find(item => item.id === itemId);
        const newItem = { ...existingItem, ...updatedItem };
        if (ItemSchema) {
            ItemSchema.parse(newItem);
        }

        const dbItem = {
            category: newItem.category,
            name: newItem.name,
            base_price: newItem.basePrice,
            unit: newItem.unit,
            is_available: newItem.isAvailable !== false,
            tiers: newItem.tiers || []
        };

        const { error } = await supabase
            .from('bb_items')
            .update(dbItem)
            .eq('id', itemId);
            
        if (error) {
            console.error("Failed to update item:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async deleteItem(itemId) {
        if (!supabase) return;
        const { error } = await supabase
            .from('bb_items')
            .delete()
            .eq('id', itemId);
            
        if (error) {
            console.error("Failed to delete item:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async getOrders() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('bb_orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("Failed to fetch orders:", error);
            throw new Error(error.message);
        }
        
        return data.map(order => ({
            id: order.id,
            buyerName: order.buyer_name,
            itemId: order.item_id,
            qty: order.qty,
            time: order.time,
            status: order.status
        }));
    }

    static async saveOrders(orders) {
        if (!supabase) return;
        const dbOrders = orders.map(order => ({
            id: order.id,
            buyer_name: order.buyerName,
            item_id: order.itemId,
            qty: order.qty,
            status: order.status,
            time: order.time
        }));
        
        const { error } = await supabase
            .from('bb_orders')
            .upsert(dbOrders);
            
        if (error) {
            console.error("Failed to save orders:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static isClosed() {
        return localStorage.getItem("bb_is_closed") === "true";
    }

    static setClosedStatus(status) {
        localStorage.setItem("bb_is_closed", status ? "true" : "false");
        this.dispatchStorageChange();
    }

    static async addOrder(buyerName, itemId, qty) {
        const parsedQty = parseInt(qty, 10);
        const orderData = {
            buyerName,
            itemId,
            qty: parsedQty
        };
        if (OrderSchema) {
            OrderSchema.parse(orderData);
        }

        if (!supabase) throw new Error("Database not connected");

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const dbOrder = {
            buyer_name: buyerName,
            item_id: itemId,
            qty: parsedQty,
            time: timeStr,
            status: "대기"
        };

        const { data, error } = await supabase
            .from('bb_orders')
            .insert(dbOrder)
            .select();
        
        if (error) {
            console.error("Failed to add order:", error);
            throw new Error(error.message);
        }

        this.dispatchStorageChange();
        
        const created = data[0];
        return {
            id: created.id,
            buyerName: created.buyer_name,
            itemId: created.item_id,
            qty: created.qty,
            time: created.time,
            status: created.status
        };
    }

    static async updateOrderStatus(orderId, status) {
        if (!supabase) return;
        const { error } = await supabase
            .from('bb_orders')
            .update({ status })
            .eq('id', orderId);
            
        if (error) {
            console.error("Failed to update order status:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async updateOrder(orderId, updatedFields) {
        if (!supabase) return;

        const orders = await this.getOrders();
        const existingOrder = orders.find(order => order.id === orderId);
        const newOrder = { ...existingOrder, ...updatedFields };
        if (OrderSchema) {
            OrderSchema.parse(newOrder);
        }

        const dbOrder = {
            buyer_name: newOrder.buyerName,
            item_id: newOrder.itemId,
            qty: newOrder.qty,
            status: newOrder.status
        };

        const { error } = await supabase
            .from('bb_orders')
            .update(dbOrder)
            .eq('id', orderId);
            
        if (error) {
            console.error("Failed to update order:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async deleteOrder(orderId) {
        if (!supabase) return;
        const { error } = await supabase
            .from('bb_orders')
            .delete()
            .eq('id', orderId);
            
        if (error) {
            console.error("Failed to delete order:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static dispatchStorageChange() {
        window.dispatchEvent(new Event('storage'));
    }

    static getAnalyticsBuyers() {
        const buyers = localStorage.getItem("bb_analytics_buyers");
        if (!buyers) {
            localStorage.setItem("bb_analytics_buyers", JSON.stringify(ANALYTICS_DATA.buyers));
            return ANALYTICS_DATA.buyers;
        }
        return JSON.parse(buyers);
    }

    static saveAnalyticsBuyers(buyers) {
        localStorage.setItem("bb_analytics_buyers", JSON.stringify(buyers));
    }

    static updateBuyerStatus(buyerName, newStatus) {
        let buyers = this.getAnalyticsBuyers();
        buyers = buyers.map(buyer => buyer.name === buyerName ? { ...buyer, status: newStatus } : buyer);
        this.saveAnalyticsBuyers(buyers);
        this.dispatchStorageChange();
    }

    static getAnalyticsData() {
        return {
            ...ANALYTICS_DATA,
            buyers: this.getAnalyticsBuyers()
        };
    }
}

// B2B 정산 계산기 (거래처별 수량에 따른 차등 도매 단가 적용 계산)
class BongBongCalculator {
    static async getItemTotalQty(itemId) {
        const orders = await BongBongStore.getOrders();
        return orders
            .filter(order => order.itemId === itemId)
            .reduce((sum, order) => sum + order.qty, 0);
    }

    static getWholesaleUnitPrice(item, qty) {
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
    }

    static async getProjectedRevenue() {
        const items = await BongBongStore.getItems();
        const orders = await BongBongStore.getOrders();
        
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

    static getTierBenefitInfo(item, qty) {
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
}

window.BongBongStore = BongBongStore;
window.BongBongCalculator = BongBongCalculator;
