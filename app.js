/**
 * BongBong Market - Core Application State & Business Logic (Mock & Supabase)
 * 공동구매 구간 단가 및 게이지바 로직을 완전히 삭제하고,
 * B2B 도매 거래처 주문 관리 및 정산 시스템으로 데이터 로직을 전면 단순화했습니다.
 */

// 0. Supabase Client 초기화
const SUPABASE_URL = "https://jobksthdcqslozwrxcxy.supabase.co";
const SUPABASE_KEY = "sb_publishable_2eMUEbeE4AOwCeHzqDXkyA_imFLRVps";

if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
var supabase = window.supabase;

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
        buyerContact: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678).").optional().or(z.literal("")),
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
            .from('items')
            .select('*, item_tiers(*)');
        
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
            tiers: (item.item_tiers || []).map(t => ({
                threshold: t.threshold,
                price: t.price
            }))
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
            is_available: item.isAvailable !== false
        };

        const { error: itemError } = await supabase
            .from('items')
            .insert(dbItem);
            
        if (itemError) {
            console.error("Failed to add item:", itemError);
            throw new Error(itemError.message);
        }

        if (item.tiers && item.tiers.length > 0) {
            const dbTiers = item.tiers.map(t => ({
                item_id: item.id,
                threshold: t.threshold,
                price: t.price
            }));
            const { error: tiersError } = await supabase
                .from('item_tiers')
                .insert(dbTiers);
            if (tiersError) {
                console.error("Failed to add item tiers:", tiersError);
                throw new Error(tiersError.message);
            }
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
            is_available: newItem.isAvailable !== false
        };

        const { error: itemError } = await supabase
            .from('items')
            .update(dbItem)
            .eq('id', itemId);
            
        if (itemError) {
            console.error("Failed to update item:", itemError);
            throw new Error(itemError.message);
        }

        const { error: deleteTiersError } = await supabase
            .from('item_tiers')
            .delete()
            .eq('item_id', itemId);

        if (deleteTiersError) {
            console.error("Failed to delete item tiers:", deleteTiersError);
            throw new Error(deleteTiersError.message);
        }

        if (newItem.tiers && newItem.tiers.length > 0) {
            const dbTiers = newItem.tiers.map(t => ({
                item_id: itemId,
                threshold: t.threshold,
                price: t.price
            }));
            const { error: insertTiersError } = await supabase
                .from('item_tiers')
                .insert(dbTiers);
            if (insertTiersError) {
                console.error("Failed to insert item tiers:", insertTiersError);
                throw new Error(insertTiersError.message);
            }
        }
        
        this.dispatchStorageChange();
    }

    static async deleteItem(itemId) {
        if (!supabase) return;
        const { error } = await supabase
            .from('items')
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
            .from('orders')
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
            .from('orders')
            .upsert(dbOrders);
            
        if (error) {
            console.error("Failed to save orders:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    static async isClosed() {
        if (!supabase) return false;
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'is_closed')
                .maybeSingle();
            if (error) throw error;
            return data ? data.value === 'true' : false;
        } catch (err) {
            console.error("Failed to check if closed:", err);
            return false;
        }
    }

    static async setClosedStatus(status) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('system_settings')
                .update({ value: status ? 'true' : 'false' })
                .eq('key', 'is_closed');
            if (error) throw error;
        } catch (err) {
            console.error("Failed to set closed status:", err);
            throw err;
        }
        this.dispatchStorageChange();
    }

    static async addOrder(buyerName, itemId, qty, buyerContact = "") {
        const parsedQty = parseInt(qty, 10);
        
        // 연락처 하이픈 자동 정리
        let formattedContact = "";
        if (buyerContact) {
            formattedContact = buyerContact.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
        }

        const orderData = {
            buyerName,
            buyerContact: formattedContact,
            itemId,
            qty: parsedQty
        };
        if (OrderSchema) {
            OrderSchema.parse(orderData);
        }

        if (!supabase) throw new Error("Database not connected");

        // RLS 및 데이터 관계 매핑을 위한 buyer_id 조회 또는 생성
        let buyerId = null;
        const { data: { user } } = await supabase.auth.getUser();
        
        // 1. 로그인된 상태라면 auth_uid 기반으로 우선 조회
        if (user) {
            const { data: buyerData } = await supabase
                .from('buyers')
                .select('id')
                .eq('auth_uid', user.id)
                .maybeSingle();
            if (buyerData) {
                buyerId = buyerData.id;
            }
        }
        
        // 2. 비로그인이거나 매핑 정보가 없으면 이름(buyerName) 기반 조회
        if (!buyerId) {
            const { data: buyerByName } = await supabase
                .from('buyers')
                .select('id, contact')
                .eq('name', buyerName)
                .maybeSingle();
            if (buyerByName) {
                buyerId = buyerByName.id;
                // 만약 새로운 연락처 정보가 입력되었으나 기존 정보가 없는 경우 업데이트
                if (formattedContact && !buyerByName.contact) {
                    const encryptedContact = BongBongCrypt.encrypt(formattedContact);
                    await supabase
                        .from('buyers')
                        .update({ contact: encryptedContact })
                        .eq('id', buyerId);
                }
            } else {
                // 3. 존재하지 않는 이름일 경우 새로운 거래처 정보 자동 생성 (연락처 암호화 저장)
                const encryptedContact = formattedContact ? BongBongCrypt.encrypt(formattedContact) : null;
                const { data: newBuyer } = await supabase
                    .from('buyers')
                    .insert({ name: buyerName, contact: encryptedContact })
                    .select('id')
                    .maybeSingle();
                if (newBuyer) {
                    buyerId = newBuyer.id;
                }
            }
        }

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const dbOrder = {
            buyer_id: buyerId,
            buyer_name: buyerName,
            item_id: itemId,
            qty: parsedQty,
            time: timeStr,
            status: "대기"
        };

        const { data, error } = await supabase
            .from('orders')
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
            .from('orders')
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
            .from('orders')
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
            .from('orders')
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

    static async getAnalyticsBuyers() {
        if (!supabase) return ANALYTICS_DATA.buyers;
        try {
            const { data: dbBuyers, error: buyersError } = await supabase
                .from('buyers')
                .select('*');
            if (buyersError) throw buyersError;

            const orders = await this.getOrders();
            const items = await this.getItems();
            
            const { data: dbSettlements, error: settlementsError } = await supabase
                .from('settlements')
                .select('*');
            if (settlementsError) throw settlementsError;

            const todayStats = {};
            orders.forEach(order => {
                const item = items.find(i => i.id === order.itemId);
                const price = BongBongCalculator.getWholesaleUnitPrice(item, order.qty);
                const subtotal = order.qty * price;

                if (!todayStats[order.buyerName]) {
                    todayStats[order.buyerName] = {
                        qty: 0,
                        revenue: 0,
                        items: {}
                    };
                }
                todayStats[order.buyerName].qty += order.qty;
                todayStats[order.buyerName].revenue += subtotal;
                todayStats[order.buyerName].items[order.itemId] = (todayStats[order.buyerName].items[order.itemId] || 0) + order.qty;
            });

            const pastStats = {};
            dbSettlements.forEach(settlement => {
                const buyerObj = dbBuyers.find(b => b.id === settlement.buyer_id);
                const buyerName = buyerObj ? buyerObj.name : "알 수 없음";

                if (!pastStats[buyerName]) {
                    pastStats[buyerName] = {
                        qty: 0,
                        revenue: 0,
                        unpaidTotal: 0
                    };
                }

                pastStats[buyerName].revenue += settlement.total_amount;
                if (settlement.payment_status === '미수금') {
                    pastStats[buyerName].unpaidTotal += settlement.total_amount;
                }

                if (settlement.detail && Array.isArray(settlement.detail)) {
                    settlement.detail.forEach(d => {
                        pastStats[buyerName].qty += (d.qty || 0);
                    });
                }
            });

            const resultBuyers = dbBuyers.map(buyer => {
                const today = todayStats[buyer.name] || { qty: 0, revenue: 0, items: {} };
                const past = pastStats[buyer.name] || { qty: 0, revenue: 0, unpaidTotal: 0 };

                const totalRevenue = past.revenue + today.revenue;
                const totalQty = past.qty + today.qty;

                let mainItem = "없음";
                let maxQty = 0;
                Object.entries(today.items).forEach(([itemId, q]) => {
                    if (q > maxQty) {
                        maxQty = q;
                        const item = items.find(i => i.id === itemId);
                        mainItem = item ? item.name : itemId;
                    }
                });

                if (mainItem === "없음" && past.revenue > 0) {
                    mainItem = "기존 정산 완료 품목";
                }

                let statusText = "정상";
                if (past.unpaidTotal > 0) {
                    statusText = `미수금 ₩${past.unpaidTotal.toLocaleString()}`;
                }

                return {
                    name: buyer.name,
                    mainItem: mainItem,
                    qty: totalQty,
                    revenue: totalRevenue,
                    status: statusText
                };
            });

            Object.keys(todayStats).forEach(name => {
                if (!resultBuyers.some(b => b.name === name)) {
                    const today = todayStats[name];
                    const past = pastStats[name] || { qty: 0, revenue: 0, unpaidTotal: 0 };

                    const totalRevenue = past.revenue + today.revenue;
                    const totalQty = past.qty + today.qty;

                    let mainItem = "없음";
                    let maxQty = 0;
                    Object.entries(today.items).forEach(([itemId, q]) => {
                        if (q > maxQty) {
                            maxQty = q;
                            const item = items.find(i => i.id === itemId);
                            mainItem = item ? item.name : itemId;
                        }
                    });

                    let statusText = "정상";
                    if (past.unpaidTotal > 0) {
                        statusText = `미수금 ₩${past.unpaidTotal.toLocaleString()}`;
                    }

                    resultBuyers.push({
                        name: name,
                        mainItem: mainItem,
                        qty: totalQty,
                        revenue: totalRevenue,
                        status: statusText
                    });
                }
            });

            return resultBuyers;
        } catch (err) {
            console.error("Failed to fetch analytics buyers:", err);
            return ANALYTICS_DATA.buyers;
        }
    }

    static async updateBuyerStatus(buyerName, newStatus) {
        if (!supabase) return;
        try {
            const { data: buyerData, error: buyerError } = await supabase
                .from('buyers')
                .select('id')
                .eq('name', buyerName)
                .maybeSingle();
            if (buyerError) throw buyerError;

            if (buyerData && newStatus === "정상") {
                const { error: updateError } = await supabase
                    .from('settlements')
                    .update({ payment_status: '수금완료' })
                    .eq('buyer_id', buyerData.id)
                    .eq('payment_status', '미수금');
                if (updateError) throw updateError;
            }
        } catch (err) {
            console.error("Failed to update buyer status:", err);
            throw err;
        }
        this.dispatchStorageChange();
    }

    static async getAnalyticsData() {
        const buyers = await this.getAnalyticsBuyers();
        if (!supabase) return { ...ANALYTICS_DATA, buyers };

        try {
            const { data: settlements, error } = await supabase
                .from('settlements')
                .select('*');
            
            if (error) throw error;

            const monthly = { ...ANALYTICS_DATA.monthly };
            const weekly = { ...ANALYTICS_DATA.weekly };
            const daily = { ...ANALYTICS_DATA.daily };

            return {
                monthly,
                weekly,
                daily,
                buyers
            };
        } catch (err) {
            console.error("Failed to fetch analytics data:", err);
            return {
                ...ANALYTICS_DATA,
                buyers
            };
        }
    }

    static async getBuyerTierBenefit(itemId, qty) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .rpc('get_buyer_tier_benefit', { p_item_id: itemId, p_qty: qty });
        if (error) {
            console.error("Failed to get buyer tier benefit:", error);
            throw new Error(error.message);
        }
        return data;
    }

    static async getApprovedOwners() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('approved_owners')
            .select('email')
            .order('created_at', { ascending: false });
        if (error) {
            console.error("Failed to fetch approved owners:", error);
            throw new Error(error.message);
        }
        return data.map(o => o.email);
    }

    static async addApprovedOwner(email) {
        if (!supabase) return;
        const { error } = await supabase
            .from('approved_owners')
            .insert({ email });
        if (error) {
            console.error("Failed to add approved owner:", error);
            throw new Error(error.message);
        }
    }

    static async deleteApprovedOwner(email) {
        if (!supabase) return;
        const { error } = await supabase
            .from('approved_owners')
            .delete()
            .eq('email', email);
    }
    static async sendAlimtalk(buyerName, contact, totalAmount, itemsDetailSummary, invoiceUrl) {
        if (!supabase) throw new Error("Database not connected");
        const { data, error } = await supabase.functions.invoke('send-alimtalk', {
            body: { buyerName, contact, totalAmount, itemsDetailSummary, invoiceUrl }
        });
        if (error) {
            console.error("Failed to invoke send-alimtalk function:", error);
            throw error;
        }
        return data;
    }

    static async saveSettlement(settlement) {
        if (!supabase) return;
        
        // Find buyer uuid if buyerId is not uuid or name matches
        let buyerId = settlement.buyerId;
        if (!buyerId) {
            const { data } = await supabase
                .from('buyers')
                .select('id')
                .eq('name', settlement.buyerName)
                .maybeSingle();
            if (data) buyerId = data.id;
        }

        const { error } = await supabase
            .from('settlements')
            .insert({
                buyer_id: buyerId,
                settled_date: settlement.settledDate,
                total_amount: settlement.totalAmount,
                detail: settlement.detail,
                send_status: settlement.sendStatus,
                sent_at: settlement.sentAt,
                error_message: settlement.errorMessage,
                payment_status: settlement.paymentStatus || '미수금'
            });
        if (error) {
            console.error("Failed to save settlement:", error);
            throw new Error(error.message);
        }
    }

    static async getSettlementsByBuyerName(buyerName) {
        if (!supabase) return [];
        try {
            const { data: buyerData } = await supabase
                .from('buyers')
                .select('id')
                .eq('name', buyerName)
                .maybeSingle();
            
            if (!buyerData) return [];

            const { data: settlements, error } = await supabase
                .from('settlements')
                .select('*')
                .eq('buyer_id', buyerData.id)
                .order('settled_date', { ascending: false });
            
            if (error) throw error;
            return settlements.map(s => ({
                id: s.id,
                settledDate: s.settled_date,
                totalAmount: s.total_amount,
                detail: s.detail,
                sendStatus: s.send_status,
                paymentStatus: s.payment_status || '미수금'
            }));
        } catch (err) {
            console.error("Failed to fetch settlements for buyer:", err);
            return [];
        }
    }

    static async updateSettlementPaymentStatus(settlementId, status) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('settlements')
                .update({ payment_status: status })
                .eq('id', settlementId);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to update settlement payment status:", err);
            throw err;
        }
        this.dispatchStorageChange();
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

// B2B 사용자 카카오 OAuth 인증 관리자 클래스
class BongBongAuth {
    static async signInWithKakao(redirectPath = '/client.html') {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: {
                redirectTo: window.location.origin + redirectPath,
                scopes: 'profile_nickname profile_image',
                queryParams: {
                    scope: 'profile_nickname profile_image'
                }
            }
        });
        if (error) {
            console.error("Kakao login failed:", error);
            throw error;
        }
    }

    static async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Signout failed:", error);
            throw error;
        }
    }

    static async getCurrentUser() {
        if (!supabase) return null;
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    static async getMyRole() {
        if (!supabase) return 'buyer';
        const user = await this.getCurrentUser();
        if (!user) return 'buyer';
        
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('id', user.id)
            .single();
            
        if (error) {
            console.error("Failed to fetch user role:", error);
            return 'buyer';
        }
        return data ? data.role : 'buyer';
    }
}

window.BongBongAuth = BongBongAuth;

const CRYPTO_SECRET = "bongbong-secret-key-1234567890";

class BongBongCrypt {
    static encrypt(text) {
        if (!text) return "";
        if (typeof CryptoJS === 'undefined') return text;
        return CryptoJS.AES.encrypt(text, CRYPTO_SECRET).toString();
    }

    static decrypt(cipher) {
        if (!cipher) return "";
        if (typeof CryptoJS === 'undefined') return cipher;
        try {
            const bytes = CryptoJS.AES.decrypt(cipher, CRYPTO_SECRET);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.error("Decryption failed:", e);
            return cipher;
        }
    }

    static maskContact(contact) {
        if (!contact) return "";
        return contact.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
    }
}

window.BongBongCrypt = BongBongCrypt;
