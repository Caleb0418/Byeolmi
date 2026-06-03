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
// zod UMD 번들은 전역을 `Zod`로 노출한다. 기존 코드는 `window.z`를 참조하므로
// 별칭을 잡아 준다. (이 누락으로 입력 검증이 조용히 비활성화돼 있었음 — silent failure 방지)
if (typeof window !== 'undefined' && !window.z && window.Zod) {
    window.z = window.Zod;
}

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

// 분석 기본 빈 구조 (실데이터가 없거나 조회 실패 시 폴백)
// 주의(P1-3): 기존의 하드코딩 더미 매출/거래처 값은 실제처럼 오인될 수 있어 제거했다.
// 실제 추이/거래처 통계는 aggregateChartData(orders) 및 getAnalyticsBuyers()가 동적으로 계산한다.
const ANALYTICS_DATA = {
    monthly: { labels: [], sales: [], volumes: [] },
    weekly:  { labels: [], sales: [], volumes: [] },
    daily:   { labels: [], sales: [], volumes: [] },
    buyers: []
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
            status: order.status,
            paymentStatus: order.payment_status || '미수금',
            createdAt: order.created_at
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

            const buyerStats = {};
            orders.forEach(order => {
                const item = items.find(i => i.id === order.itemId);
                const price = BongBongCalculator.getWholesaleUnitPrice(item, order.qty);
                const subtotal = order.qty * price;

                if (!buyerStats[order.buyerName]) {
                    buyerStats[order.buyerName] = {
                        unpaidCount: 0,
                        unpaidTotal: 0,
                        revenue: 0,
                        lastOrderDate: null
                    };
                }

                buyerStats[order.buyerName].revenue += subtotal;

                // 최근 발주 일자 갱신 (orders는 created_at 역순 정렬되어 있으므로 첫 번째 값을 취함)
                if (!buyerStats[order.buyerName].lastOrderDate && order.createdAt) {
                    const dateObj = new Date(order.createdAt);
                    buyerStats[order.buyerName].lastOrderDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
                }

                if (order.paymentStatus === '미수금') {
                    buyerStats[order.buyerName].unpaidCount += 1;
                    buyerStats[order.buyerName].unpaidTotal += subtotal;
                }
            });

            const resultBuyers = dbBuyers.map(buyer => {
                const stats = buyerStats[buyer.name] || { unpaidCount: 0, unpaidTotal: 0, revenue: 0, lastOrderDate: null };

                let statusText = "정상";
                if (stats.unpaidTotal > 0) {
                    statusText = `미수금 ₩${stats.unpaidTotal.toLocaleString()}`;
                }

                return {
                    name: buyer.name,
                    lastOrderDate: stats.lastOrderDate || "발주 이력 없음",
                    unpaidCount: stats.unpaidCount,
                    revenue: stats.revenue,
                    status: statusText
                };
            });

            // 바이어 테이블에 없으나 오늘 발주를 넣은 임시 바이어가 있다면 머지
            Object.keys(buyerStats).forEach(name => {
                if (!resultBuyers.some(b => b.name === name)) {
                    const stats = buyerStats[name];

                    let statusText = "정상";
                    if (stats.unpaidTotal > 0) {
                        statusText = `미수금 ₩${stats.unpaidTotal.toLocaleString()}`;
                    }

                    resultBuyers.push({
                        name: name,
                        lastOrderDate: stats.lastOrderDate || "발주 이력 없음",
                        unpaidCount: stats.unpaidCount,
                        revenue: stats.revenue,
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
            if (newStatus === "정상") {
                const { error } = await supabase
                    .from('orders')
                    .update({ payment_status: '수금완료' })
                    .eq('buyer_name', buyerName)
                    .eq('payment_status', '미수금');
                if (error) throw error;
            }
        } catch (err) {
            console.error("Failed to update buyer status:", err);
            throw err;
        }
        this.dispatchStorageChange();
    }

    static async getAnalyticsData() {
        const buyers = await this.getAnalyticsBuyers();
        if (!supabase) return { ...ANALYTICS_DATA, buyers, orders: [], items: [] };

        try {
            const orders = await this.getOrders();
            const items = await this.getItems();

            return {
                monthly: ANALYTICS_DATA.monthly,
                weekly: ANALYTICS_DATA.weekly,
                daily: ANALYTICS_DATA.daily,
                buyers,
                orders,
                items
            };
        } catch (err) {
            console.error("Failed to fetch analytics data:", err);
            // (P2-2) 조용한 폴백을 사용자에게 알림 (브라우저에서만 동작)
            if (typeof window !== 'undefined' && window.BongBongUI) {
                window.BongBongUI.toast("분석 데이터 일부를 불러오지 못했습니다.");
            }
            return {
                ...ANALYTICS_DATA,
                buyers,
                orders: [],
                items: []
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
        // (P2-2) 조용한 실패 제거: 오류를 로깅하고 호출부로 전파한다.
        if (error) {
            console.error("Failed to delete approved owner:", error);
            throw new Error(error.message);
        }
    }

    // (P3-3) 운영 설정(계좌/상호) — 하드코딩 제거. 테이블이 없거나 비어 있어도 기본값으로 안전 폴백.
    static get DEFAULT_SETTINGS() {
        return {
            business_name: '별미집',
            bank_name: '국민은행',
            account_number: '646801-01-557728',
            account_holder: '김봉준(우모유통)'
        };
    }

    static async getSettings() {
        const defaults = this.DEFAULT_SETTINGS;
        if (!supabase) return { ...defaults };
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value');
            if (error) throw error;
            const map = { ...defaults };
            (data || []).forEach(row => {
                if (row.value) map[row.key] = row.value;
            });
            return map;
        } catch (err) {
            // app_settings 테이블 미생성 시에도 기본값으로 동작 (마이그레이션 전 안전)
            console.error("Failed to fetch settings (기본값 사용):", err);
            return { ...defaults };
        }
    }

    static async updateSettings(entries) {
        if (!supabase) return;
        const rows = Object.entries(entries).map(([key, value]) => ({
            key,
            value: value == null ? '' : String(value),
            updated_at: new Date().toISOString()
        }));
        const { error } = await supabase
            .from('app_settings')
            .upsert(rows, { onConflict: 'key' });
        if (error) {
            console.error("Failed to update settings:", error);
            throw new Error(error.message);
        }
        this.dispatchStorageChange();
    }

    // 설정값으로부터 계좌 표기 문자열들을 생성 (표시 형식 일원화)
    static formatAccount(settings) {
        const s = settings || this.DEFAULT_SETTINGS;
        const bank = s.bank_name || '';
        const acct = s.account_number || '';
        const holder = s.account_holder || '';
        return {
            bankAccount: `${bank} ${acct}`.trim(),              // 예: "국민은행 646801-01-557728"
            holder,                                              // 예: "김봉준(우모유통)"
            full: `${bank} ${acct} ${holder}`.trim(),           // 복사용 전체 문자열
            digits: acct.replace(/[^0-9]/g, '')                 // 숫자만
        };
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

    // (P1-2) 발주 접수 확인 알림톡 발송 (구매자 대상).
    // 호출부(client.html)에서 fail-safe 로 처리하여 발송 실패가 발주 성공을 막지 않도록 한다.
    static async sendOrderConfirmation(buyerName, contact, itemsDetailSummary) {
        if (!supabase) throw new Error("Database not connected");
        const { data, error } = await supabase.functions.invoke('send-alimtalk', {
            body: { type: 'order_confirm', buyerName, contact, itemsDetailSummary }
        });
        if (error) {
            console.error("Failed to invoke order confirmation alimtalk:", error);
            throw error;
        }
        return data;
    }

    // (P1-1) 알림톡 발송에 실패한 정산 내역 조회 (거래처 정보 포함)
    static async getFailedSettlements() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('settlements')
            .select('*, buyers(name, contact)')
            .eq('send_status', 'failed')
            .order('created_at', { ascending: false });
        if (error) {
            console.error("Failed to fetch failed settlements:", error);
            throw new Error(error.message);
        }
        return data.map(s => ({
            id: s.id,
            buyerName: s.buyers ? s.buyers.name : '(알 수 없는 거래처)',
            settledDate: s.settled_date,
            totalAmount: s.total_amount,
            errorMessage: s.error_message
        }));
    }

    // (P1-1) 단일 정산 건 알림톡 재전송. 명세서 요약을 재구성해 Edge Function 재호출 후 상태 갱신.
    static async resendAlimtalk(settlementId) {
        if (!supabase) throw new Error("Database not connected");

        // 1. 정산 + 거래처 정보 로드
        const { data: s, error } = await supabase
            .from('settlements')
            .select('*, buyers(name, contact)')
            .eq('id', settlementId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (!s) throw new Error("정산 내역을 찾을 수 없습니다.");

        const buyerName = s.buyers ? s.buyers.name : '';
        const contact = s.buyers && s.buyers.contact
            ? BongBongCrypt.decrypt(s.buyers.contact)
            : '010-0000-0000';

        // 2. 명세서 요약 재구성 (settlement.detail: [{ itemId, qty, price }])
        const items = await this.getItems();
        let itemsDetailSummary = "";
        (s.detail || []).forEach(d => {
            const item = items.find(i => i.id === d.itemId);
            const name = item ? item.name : d.itemId;
            const unit = item ? item.unit : '';
            const subtotal = (d.qty || 0) * (d.price || 0);
            itemsDetailSummary += `- ${name} (${d.qty}${unit}): ₩${subtotal.toLocaleString()}\n`;
        });
        const invoiceUrl = window.location.origin + `/invoice.html?buyer=${encodeURIComponent(buyerName)}`;

        // 3. 재발송 시도 후 결과를 정산 상태에 반영
        try {
            await this.sendAlimtalk(buyerName, contact, s.total_amount, itemsDetailSummary, invoiceUrl);
            const { error: upErr } = await supabase
                .from('settlements')
                .update({ send_status: 'sent', sent_at: new Date().toISOString(), error_message: null })
                .eq('id', settlementId);
            if (upErr) throw new Error(upErr.message);
            this.dispatchStorageChange();
            return { success: true };
        } catch (sendErr) {
            await supabase
                .from('settlements')
                .update({ send_status: 'failed', error_message: sendErr.message })
                .eq('id', settlementId);
            this.dispatchStorageChange();
            throw sendErr;
        }
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

    static async getOrdersByBuyerName(buyerName) {
        if (!supabase) return [];
        try {
            const orders = await this.getOrders();
            const items = await this.getItems();
            
            const buyerOrders = orders.filter(o => o.buyerName === buyerName);
            
            return buyerOrders.map(o => {
                const item = items.find(i => i.id === o.itemId);
                const price = BongBongCalculator.getWholesaleUnitPrice(item, o.qty);
                
                return {
                    id: o.id,
                    createdAt: o.createdAt,
                    itemName: item ? item.name : o.itemId,
                    qty: o.qty,
                    unit: item ? item.unit : '박스',
                    price: price,
                    paymentStatus: o.paymentStatus || '미수금'
                };
            });
        } catch (err) {
            console.error("Failed to fetch orders for buyer:", err);
            return [];
        }
    }

    static async updateOrderPaymentStatus(orderId, status) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('orders')
                .update({ payment_status: status })
                .eq('id', orderId);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to update order payment status:", err);
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
                    scope: 'profile_nickname profile_image',
                    prompt: 'select_account'
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

// 연락처 보호 정책 (P0-2)
// - 기존에는 CryptoJS.AES 로 클라이언트에서 암호화했으나, 키(CRYPTO_SECRET)가 소스에 노출되어
//   누구나 복호화 가능 → 실질적 보안 효과가 없었으므로 제거했다.
// - 실제 보안 경계는 buyers 테이블의 RLS(소유자 또는 본인만 select/update 가능)가 담당한다.
//   따라서 연락처는 평문으로 저장하고, 화면 노출 시에는 maskContact() 로 마스킹한다.
// - encrypt/decrypt 는 호출부 호환을 위해 패스스루로 유지한다. (실제 변환 없음)
class BongBongCrypt {
    // 평문 저장 (RLS 로 보호). 호출부 호환용 패스스루.
    static encrypt(text) {
        return text || "";
    }

    // 평문은 그대로 반환. 레거시 AES 암호문('Salted__' base64 → 'U2FsdGVk' 접두)은
    // 키가 더 이상 존재하지 않아 복호화 불가하므로 빈 값으로 처리(재입력 유도).
    static decrypt(value) {
        if (!value) return "";
        if (typeof value === 'string' && value.startsWith('U2FsdGVk')) {
            console.warn("레거시 암호화 연락처는 복호화할 수 없습니다. 재입력이 필요합니다.");
            return "";
        }
        return value;
    }

    static maskContact(contact) {
        if (!contact) return "";
        return contact.replace(/(\d{3})-(\d{3,4})-(\d{4})/, '$1-****-$3');
    }
}

window.BongBongCrypt = BongBongCrypt;

// (P2-2) 공용 사용자 알림(toast) 유틸 — 조용한 실패를 사용자에게 노출하기 위함.
// 브라우저에서만 동작하고, document 가 없으면(테스트 등) 안전하게 no-op 한다.
const BongBongUI = {
    toast(message, type = 'error') {
        try {
            if (typeof document === 'undefined' || !document.body) return;
            let container = document.getElementById('bb-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'bb-toast-container';
                container.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
                document.body.appendChild(container);
            }
            const colors = { error: '#dc2626', success: '#16a34a', info: '#334155' };
            const el = document.createElement('div');
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.style.cssText = `pointer-events:auto;max-width:90vw;padding:10px 16px;border-radius:12px;color:#fff;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.18);background:${colors[type] || colors.info};opacity:0;transition:opacity .2s ease;`;
            el.textContent = message;
            container.appendChild(el);
            requestAnimationFrame(() => { el.style.opacity = '1'; });
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 250);
            }, 3500);
        } catch (e) {
            // 토스트 표시 실패가 앱 흐름을 막지 않도록 무시
        }
    }
};
window.BongBongUI = BongBongUI;

// Node.js 테스트 환경을 위한 CommonJS export (브라우저에서는 module 이 없어 무시됨)
// 테스트가 복붙 사본이 아닌 실제 프로덕션 로직을 검증하도록 한다 (드리프트 방지).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BongBongCalculator,
        BongBongStore,
        BongBongAuth,
        BongBongCrypt,
        BongBongUI,
        CATEGORIES
    };
}
