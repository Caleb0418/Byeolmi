# 사용자 흐름도 (User Flow)

봉봉 마켓(BongBong Market) 서비스를 이용하는 **두 가지 핵심 페르소나(구매자 박민지, 공급자 김성식 사장님)**의 업무 진행 및 시스템 상호작용 단계를 상세히 시각화한 사용자 흐름도입니다.

---

## 1. 구매자(업자)의 주문 및 실시간 단가 조회 흐름 (Buyer User Flow)

구매자가 카카오톡 채널에 진입하여 주문을 접수하고, 공구 혜택을 확인하며, 최종 마감 정산 내역을 수신하기까지의 동선입니다.

```mermaid
flowchart TD
    Start([카카오톡 채널 대화방 진입]) --> Menu{메뉴 선택}
    
    %% 주문하기 분기
    Menu -->|주문하기 터치| OrderView[간편 주문서 웹뷰 오픈]
    OrderView --> SelectItem[1. 품목 및 수량 선택]
    SelectItem --> CheckInfo{기존 주문자 정보 존재?}
    CheckInfo -->|No| InputInfo[업체명, 주소, 연락처 등록]
    CheckInfo -->|Yes| SubmitOrder[주문 완료 제출]
    InputInfo --> SubmitOrder
    SubmitOrder --> OrderConfirm[카톡 주문 요약 알림 수신]
    OrderConfirm --> EndOrder([대기 상태])

    %% 실시간 단가 현황 확인 분기
    Menu -->|실시간 현황판 터치| ProgressView[공구 달성도 그래프 웹뷰]
    ProgressView --> ReadGauge[현재 누적량 및 적용 단가 확인]
    ReadGauge --> Suggestion{다음 할인 구간까지 소량 남음?}
    Suggestion -->|Yes: 추가 구매 유도| OrderView
    Suggestion -->|No| CloseView([대화방 복귀])

    %% 마감 및 정산 알림 수신
    EndOrder -->|사장님 마감 완료 시| BillNotification[최종 정산 알림톡 도착]
    BillNotification --> CopyAccount[계좌번호 복사 & 이체 실행]
    CopyAccount --> CompletePayment([정산 처리 완료])
```

---

## 2. 공급자(사장님)의 일일 취합, 마감 및 정산 흐름 (Supplier User Flow)

도매 사장님이 당일 주문 상황을 모니터링하고, 전화 주문 예외 처리를 거쳐 당일 공동구매를 마감 및 정산 통보하는 동선입니다.

```mermaid
flowchart TD
    StartAdmin([관리자 대시보드 로그인]) --> RefreshBoard[실시간 주문 테이블 자동 갱신]
    
    %% 전화 주문 처리 분기
    RefreshBoard --> CheckPhone{전화/수기 주문 접수?}
    CheckPhone -->|Yes| AddManualOrder[주문 직접 추가 버튼 클릭]
    AddManualOrder --> InputManual[업체명, 품목, 수량 입력 후 저장]
    InputManual --> RefreshBoard
    CheckPhone -->|No| MonitorProgress[품목별 공구 달성도 모니터링]

    %% 마감 시점 처리
    MonitorProgress --> TimeCheck{마감 시간 17:00 도달?}
    TimeCheck -->|No| RefreshBoard
    TimeCheck -->|Yes| ClickClose[1. 당일 주문 마감 실행]
    
    ClickClose --> AutoCalculate[2. 시스템: 누적 주문 수량 기준 최종 단가 자동 적용]
    AutoCalculate --> ConfirmReview[3. 최종 정산 내역서 검토 및 확인]
    ConfirmReview --> ClickNotify[4. 정산 알림톡 일괄 발송 클릭]
    
    ClickNotify --> SendKakaoSync[5. 카톡 API를 통한 개별 확정 청구서 전송]
    SendKakaoSync --> MonitorDeposit[6. 입금 대기 목록 모니터링]
    MonitorDeposit --> CompleteDay([일과 종료])
```
