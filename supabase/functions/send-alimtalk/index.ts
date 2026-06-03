// Deno Supabase Edge Function to send Kakao Alimtalk via Solapi API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") || "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") || "";
const SOLAPI_SENDER_NUMBER = Deno.env.get("SOLAPI_SENDER_NUMBER") || "";
const SOLAPI_PFID = Deno.env.get("SOLAPI_PFID") || ""; // Kakao PFID (카카오 비즈니스 채널 연동 고유 ID)
const SOLAPI_TEMPLATE_ID = Deno.env.get("SOLAPI_TEMPLATE_ID") || ""; // 정산 요청 알림톡 템플릿 ID
// (P1-2) 발주 접수 확인용 알림톡 템플릿 ID. 별도 카카오 템플릿 사전 승인 필요.
// 미설정 시 정산 템플릿으로 폴백하지만, 템플릿 변수 불일치로 발송이 거부될 수 있다.
const SOLAPI_ORDER_TEMPLATE_ID = Deno.env.get("SOLAPI_ORDER_TEMPLATE_ID") || SOLAPI_TEMPLATE_ID;
// (P3-3) 입금 계좌 안내 문구 — 하드코딩 제거. Supabase Secrets 의 BANK_INFO 로 설정, 미설정 시 기본값.
const BANK_INFO = Deno.env.get("BANK_INFO") || "국민은행 646801-01-557728 (김봉준 우모유통)";

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Solapi HMAC Header Signature Generator
function getSolapiHeaders() {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  
  // HMAC SHA256 Signature
  // Deno Web Crypto API 활용
  const data = date + salt;
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(SOLAPI_API_SECRET);
  const dataBuf = encoder.encode(data);
  
  // We can also use simple HMAC signature or standard library
  // For simplicity and robust runtime execution in Deno:
  // Solapi signature is: hmac_sha256(secret, date + salt)
  // Let's implement it using WebCrypto
  return {
    date,
    salt,
  };
}

// Generate Auth Signature using Crypto Subtle
async function getAuthHeaderValue(date: string, salt: string) {
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(SOLAPI_API_SECRET);
  const dataBuf = encoder.encode(date + salt);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const sigBuf = await crypto.subtle.sign("HMAC", key, dataBuf);
  const sigArray = Array.from(new Uint8Array(sigBuf));
  const signature = sigArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { buyerName, contact, totalAmount, itemsDetailSummary, invoiceUrl, type = "settlement" } = await req.json();

    // 타입별 필수 파라미터 검증
    // - settlement(정산 요청): buyerName, contact, totalAmount 필수
    // - order_confirm(발주 접수 확인): buyerName, contact, itemsDetailSummary 필수
    const isOrderConfirm = type === "order_confirm";
    const missingCommon = !buyerName || !contact;
    const missingSettlement = !isOrderConfirm && !totalAmount;
    const missingOrder = isOrderConfirm && !itemsDetailSummary;
    if (missingCommon || missingSettlement || missingOrder) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      return new Response(JSON.stringify({ error: "Solapi API keys are not configured on server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Solapi Auth Headers 구성
    const { date, salt } = getSolapiHeaders();
    const authorization = await getAuthHeaderValue(date, salt);

    // 2. 알림톡 발송 양식 (타입별 문구/템플릿 구성)
    let messageBody: string;
    let templateId: string;
    const kakaoButtons: Array<Record<string, string>> = [];

    if (isOrderConfirm) {
      // (P1-2) 발주 접수 확인 알림톡
      messageBody = `[별미집 발주 접수 안내]

안녕하세요, ${buyerName} 대표님.
요청하신 발주가 정상적으로 접수되었습니다.

■ 발주 내역:
${itemsDetailSummary}

당일 공구 마감 후 확정 단가가 적용된 정산 명세서를 다시 보내드립니다.
감사합니다.`;
      templateId = SOLAPI_ORDER_TEMPLATE_ID;
    } else {
      // 정산 요청 알림톡 (기존 동작)
      messageBody = `[별미집 정산 요청 안내]

안녕하세요, ${buyerName} 대표님.
금일 별미집 도매 발주에 대한 정산 명세서가 발행되었습니다.

■ 거래 내역 요약:
${itemsDetailSummary}

■ 최종 청구 금액: ₩${Number(totalAmount).toLocaleString()}
■ 입금 계좌: ${BANK_INFO}

아래 버튼을 눌러 상세 정산 명세서(송금계좌 및 금액)를 확인해 주시기 바랍니다.`;
      templateId = SOLAPI_TEMPLATE_ID;
      if (invoiceUrl) {
        kakaoButtons.push({
          buttonType: "WL", // 웹링크 버튼
          buttonName: "상세 정산 명세서 보기",
          linkMo: invoiceUrl,
          linkPc: invoiceUrl,
        });
      }
    }

    const kakaoOptions: Record<string, unknown> = {
      pfId: SOLAPI_PFID,
      templateId: templateId,
    };
    if (kakaoButtons.length > 0) {
      kakaoOptions.buttons = kakaoButtons;
    }

    const solapiPayload = {
      messages: [
        {
          to: contact.replace(/[^0-9]/g, ""), // 숫자만 전송
          from: SOLAPI_SENDER_NUMBER,
          text: messageBody,
          type: "ATA", // 알림톡 타입 ATA
          kakaoOptions: kakaoOptions,
        }
      ]
    };

    // 3. 외부 API 전송
    const response = await fetch("https://api.solapi.com/messages/v4/send-many", {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(solapiPayload),
    });

    const result = await response.json();

    if (!response.ok || (result.failedMessageCount && result.failedMessageCount > 0)) {
      const errorMsg = result.errorMessage || (result.messages && result.messages[0]?.reason) || "API call failed";
      return new Response(JSON.stringify({ success: false, error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
