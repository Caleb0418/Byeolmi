# 구글 스티치용 프론트엔드 프롬프트 가이드

구글 스티치(`stitch.withgoogle.com`)에 복사하여 붙여넣어 완벽한 UI 레이아웃과 코드를 생성할 수 있는 전용 프롬프트 리스트입니다.

---

## 1. 공급자용 관리자 대시보드 (Admin Dashboard) 프롬프트

구글 스티치의 UI 생성 창에 아래의 영어 프롬프트를 통째로 복사해서 입력하세요.

```text
Create a high-fidelity, premium responsive web dashboard for a food wholesale supplier named "BongBong Market". 
The design system should use clean, elegant glassmorphic components with a modern HSL theme (primary: deep blue, slate background, vibrant accent green). 

Key Sections to include:
1. Header: showing title "BongBong Market Admin", date controller, and status indicators.
2. Summary Cards:
   - "Total Group Buy Progress" (progress bar indicating current volume / next target discount tier)
   - "Active Buyers Count" (number of buyers today)
   - "Projected Revenue" (in KRW)
3. Real-time Order Table: Columns for Buyer Name, Item Name, Quantity, Order Time, Status (Pending, Confirmed, Shipped). Include a button to manually add an order (for phone orders).
4. Daily Control Panel:
   - Big prominent button: "Close Today's Group Buy" (trigger sliding price lock)
   - Big prominent button: "Send Auto-Settlement Kakao Notification" (to send final invoices)
5. Items & Tier Settings Section: list of 5 active food items (e.g., Potato, Onion, Carrot) showing their sliding price tiers (e.g., 1-50 boxes: $20, 51-100 boxes: $18, 100+ boxes: $15) with dynamic progress bars.
```

---

## 2. 구매자용 모바일 웹뷰 (Mobile Web View) 프롬프트

모바일 챗봇에서 열릴 간편 주문 전용 화면을 생성하기 위한 프롬프트입니다.

```text
Create a premium, mobile-optimized (vertical portrait view) web page for wholesale group buying customers of "BongBong Market". 
It should look like a KakaoTalk in-app webview. Modern typography, soft gradients, and extremely clean layout.

Key Sections to include:
1. Header: "BongBong Market - Easy Group Order" with brief user guidelines.
2. Group Buy Progress Gauge (Core Feature):
   - A visual progress bar showing today's accumulated order volume for hot items.
   - Text indicator: "Only 15 boxes left to unlock 15% discount for everyone!" to encourage ordering.
3. Order Sheet Form:
   - Item Selection dropdown/selector (Potato, Onion, Carrot).
   - Quantity counter selector with "+" and "-" buttons.
   - Customer Information fields: Business Name, Delivery Address, Contact Number (Make it clear these will be saved for next time).
4. Actions:
   - Giant button: "Submit Order" (Active state)
   - Secondary button: "My Order History"
```

---

## 3. 스티치 결과물 코드 적용 방법
1. 구글 스티치에서 위 프롬프트로 디자인을 생성합니다.
2. 우측 상단의 **[Export Code]** 버튼을 눌러 HTML과 CSS 코드를 다운로드합니다.
3. 다운로드한 코드를 복사하여 우리 프로젝트 폴더의 [index.html](file:///c:/Users/seung/Desktop/유승종/11_BongBong/index.html) 및 [client.html](file:///c:/Users/seung/Desktop/유승종/11_BongBong/client.html)에 덮어씌워 보강합니다.
